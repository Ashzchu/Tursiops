import * as vscode from 'vscode';
import { GeminiProvider } from '../ai/GeminiProvider';
import { WorkflowState } from './WorkflowState';
import { MemoryStore } from '../memory/MemoryStore';
import { MemoryEvent, FileMemory } from '../memory/MemorySchema';
import { validateChange, validateChangeSize } from '../changes/ChangeValidator';
import { parseChange } from '../changes/ChangeParser';
import { showDiff } from '../changes/DiffPreview';
import { applyChange } from '../changes/WorkspaceEditor';
import { runLint } from '../validation/LintRunner';
import { runTypeCheck } from '../validation/TestRunner';
import { log, logError, showChannel } from '../utils/logging';
import { ValidationResult } from '../validation/ValidationResult';

export const MAX_CORRECTION_ATTEMPTS = 3;

export interface OrchestratorOptions {
  activeFileUri: vscode.Uri;
  activeFilePath: string;   // relative path
  language: string;
  originalContent: string;
  memory: FileMemory;
  fileId: string;
  userPrompt: string;
  geminiProvider: GeminiProvider;
  workflowState: WorkflowState;
  memoryStore: MemoryStore;
  workspaceRoot: string;
  relatedFiles?: Array<{ path: string; content: string }>;
}

export class AgentOrchestrator {
  async runWithValidation(options: OrchestratorOptions): Promise<void> {
    const {
      activeFileUri, activeFilePath, language, originalContent,
      memory, fileId, userPrompt, geminiProvider, workflowState,
      memoryStore, workspaceRoot, relatedFiles = [],
    } = options;

    let currentContent = originalContent;
    let correctionPrompt = userPrompt;

    for (let attempt = 1; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      showChannel();
      log(`Attempt ${attempt}/${MAX_CORRECTION_ATTEMPTS}: Calling Gemini...`);

      const packet = {
        filePath: activeFilePath,
        language,
        userPrompt: correctionPrompt,
        currentFile: { content: currentContent, hash: '' },
        memory: {
          summary: memory.summary,
          constraints: memory.constraints,
          decisions: memory.decisions,
          knownFlaws: memory.knownFlaws,
        },
        relatedFiles,
      };

      let response;
      try {
        response = await geminiProvider.requestChange(correctionPrompt, packet);
      } catch (err) {
        logError('Gemini request failed', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      log(`Gemini response received (confidence: ${response.confidence})`);

      try {
        validateChange(response, activeFileUri.fsPath);
        validateChangeSize(currentContent, response.updatedFile);
      } catch (err) {
        logError('Validation failed', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const parsed = parseChange(response, currentContent);

      workflowState.pendingResponse = response;
      workflowState.pendingFilePath = activeFileUri.fsPath;
      workflowState.pendingOriginalContent = currentContent;

      const decision = await showDiff(parsed.originalContent, parsed.proposedContent, activeFileUri.fsPath);

      if (decision === 'rejected') {
        vscode.window.showInformationMessage('Tursiops: Change rejected — file unchanged.');
        workflowState.clear();
        return;
      }

      try {
        await applyChange(activeFileUri, parsed.proposedContent);
        currentContent = parsed.proposedContent;
      } catch (err) {
        logError('Failed to apply change', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      workflowState.clear();
      log('Change applied. Running validation...');

      const [typeCheckResult, lintResult] = await Promise.all([
        runTypeCheck(workspaceRoot),
        runLint(workspaceRoot),
      ]);

      const allPassed = typeCheckResult.passed && lintResult.passed;

      const validationEvent: MemoryEvent = {
        timestamp: new Date().toISOString(),
        type: 'validation',
        summary: allPassed
          ? `Validation passed on attempt ${attempt}`
          : `Validation failed on attempt ${attempt}`,
        detail: !allPassed
          ? [
              !typeCheckResult.passed ? `check-types: ${typeCheckResult.output}` : '',
              !lintResult.passed ? `lint: ${lintResult.output}` : '',
            ].filter(Boolean).join('\n').slice(0, 1000)
          : undefined,
      };
      memoryStore.appendEvent(fileId, validationEvent);

      const changeEvent: MemoryEvent = {
        timestamp: new Date().toISOString(),
        type: 'change',
        summary: parsed.summary,
        detail: parsed.decisions.join('; '),
      };
      memoryStore.appendEvent(fileId, changeEvent);
      await memoryStore.save();

      if (allPassed) {
        log('Validation passed.');
        vscode.window.showInformationMessage(`Tursiops: Change applied and validated ✓ — ${parsed.summary}`);
        return;
      }

      // Validation failed
      log(`Validation failed on attempt ${attempt}.`);
      if (!typeCheckResult.passed) { log(`check-types errors:\n${typeCheckResult.output}`); }
      if (!lintResult.passed) { log(`lint errors:\n${lintResult.output}`); }

      if (attempt < MAX_CORRECTION_ATTEMPTS) {
        const errors = [
          !typeCheckResult.passed ? `TypeScript errors:\n${typeCheckResult.output}` : '',
          !lintResult.passed ? `Lint errors:\n${lintResult.output}` : '',
        ].filter(Boolean).join('\n\n');

        correctionPrompt = `The previous change introduced the following errors. Fix ONLY these errors without changing anything else:\n\n${errors}\n\nOriginal task: ${userPrompt}`;
        log(`Retrying with correction (attempt ${attempt + 1})...`);
      } else {
        log(`Correction limit (${MAX_CORRECTION_ATTEMPTS}) reached. Manual fix required.`);
        vscode.window.showWarningMessage(
          `Tursiops: Correction limit reached after ${MAX_CORRECTION_ATTEMPTS} attempts. Manual fix required.`
        );
      }
    }
  }
}
