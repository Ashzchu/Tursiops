import * as vscode from 'vscode';
import { GeminiProvider } from '../ai/GeminiProvider';
import { ApiKeyManager } from '../ai/ApiKeyManager';
import { WorkflowState } from '../orchestrator/WorkflowState';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { getWorkspaceRoot } from '../utils/paths';
import { log, logError, showChannel } from '../utils/logging';
import { validateChange, validateChangeSize } from '../changes/ChangeValidator';
import { parseChange } from '../changes/ChangeParser';
import { showDiff } from '../changes/DiffPreview';
import { applyChange } from '../changes/WorkspaceEditor';
import { MemoryEvent } from '../memory/MemorySchema';

export function registerAskForChange(
  context: vscode.ExtensionContext,
  geminiProvider: GeminiProvider,
  apiKeyManager: ApiKeyManager,
  workflowState: WorkflowState,
  memoryStore: MemoryStore
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.askForChange', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Tursiops: No active file open.');
        return;
      }

      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('Tursiops: No workspace folder open.');
        return;
      }

      // Ensure key is set
      let key = await apiKeyManager.getGeminiKey();
      if (!key) {
        const entered = await vscode.window.showInputBox({
          prompt: 'Enter your Gemini API key (stored securely in VS Code SecretStorage)',
          password: true,
          placeHolder: 'AIza...',
        });
        if (!entered) { return; }
        await apiKeyManager.setGeminiKey(entered);
        key = entered;
      }

      const userPrompt = await vscode.window.showInputBox({
        prompt: 'What change should Tursiops make to this file?',
        placeHolder: 'e.g. Add input validation to the processUser function',
      });
      if (!userPrompt) { return; }

      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      const fileId = getFileId(relativePath);
      const originalContent = editor.document.getText();
      const language = editor.document.languageId;

      await memoryStore.load();
      const memory = memoryStore.getOrCreate(fileId, relativePath, language);

      showChannel();
      log(`Sending request to Gemini: "${userPrompt}"`);

      const packet = {
        filePath: relativePath,
        language,
        userPrompt,
        currentFile: { content: originalContent, hash: '' },
        memory: {
          summary: memory.summary,
          constraints: memory.constraints,
          decisions: memory.decisions,
          knownFlaws: memory.knownFlaws,
        },
        relatedFiles: [],
      };

      let response;
      try {
        response = await geminiProvider.requestChange(userPrompt, packet);
      } catch (err) {
        logError('Gemini request failed', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      log(`Gemini responded with confidence: ${response.confidence}`);

      try {
        validateChange(response, editor.document.uri.fsPath);
        validateChangeSize(originalContent, response.updatedFile);
      } catch (err) {
        logError('Change validation failed', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const parsed = parseChange(response, originalContent);

      // Store in workflow state so reviewChange can re-open the diff
      workflowState.pendingResponse = response;
      workflowState.pendingFilePath = editor.document.uri.fsPath;
      workflowState.pendingOriginalContent = originalContent;

      const decision = await showDiff(parsed.originalContent, parsed.proposedContent, editor.document.uri.fsPath);

      if (decision === 'rejected') {
        vscode.window.showInformationMessage('Tursiops: Change rejected — file unchanged.');
        workflowState.clear();
        return;
      }

      try {
        await applyChange(editor.document.uri, parsed.proposedContent);
      } catch (err) {
        logError('Failed to apply change', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const event: MemoryEvent = {
        timestamp: new Date().toISOString(),
        type: 'change',
        summary: parsed.summary,
        detail: parsed.decisions.join('; '),
      };
      memoryStore.appendEvent(fileId, event);
      await memoryStore.save();

      workflowState.clear();
      log(`Change applied to ${relativePath}`);
      vscode.window.showInformationMessage(`Tursiops: Change applied — ${parsed.summary}`);
    })
  );
}
