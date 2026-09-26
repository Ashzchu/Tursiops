import * as vscode from 'vscode';

import { registerExplainFile } from './commands/explainFile';
import { registerShowMemory } from './commands/showMemory';
import { registerClearFileMemory } from './commands/clearFileMemory';
import { registerAskForChange } from './commands/askForChange';
import { registerReviewChange } from './commands/reviewChange';

import { MemoryStore } from './memory/MemoryStore';
import { ApiKeyManager } from './ai/ApiKeyManager';
import { QwenProvider } from './ai/QwenProvider';
import { GeminiProvider } from './ai/GeminiProvider';
import { ProviderRouter } from './ai/ProviderRouter';
import { WorkflowState } from './orchestrator/WorkflowState';
import { AgentOrchestrator } from './orchestrator/AgentOrchestrator';

import { getWorkspaceRoot } from './utils/paths';
import { log, logError } from './utils/logging';

export function activate(context: vscode.ExtensionContext): void {
  log('Tursiops is now active.');

  // ── Workspace trust guard ──────────────────────────────────────────────────
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      'Tursiops: This workspace is not trusted. AI features are disabled.'
    );
    // Only register the safe read-only commands
    registerExplainFile(context);
    return;
  }

  // ── Workspace root guard ───────────────────────────────────────────────────
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage(
      'Tursiops: No workspace folder open. Open a folder to enable memory features.'
    );
    registerExplainFile(context);
    return;
  }

  // ── Singletons ─────────────────────────────────────────────────────────────
  const memoryStore = new MemoryStore(workspaceRoot);
  const apiKeyManager = new ApiKeyManager(context.secrets);
  const qwenProvider = new QwenProvider();
  const geminiProvider = new GeminiProvider(apiKeyManager);
  const providerRouter = new ProviderRouter(qwenProvider, geminiProvider);
  const workflowState = new WorkflowState();
  const agentOrchestrator = new AgentOrchestrator();

  // Suppress unused-variable warnings for singletons used indirectly via commands
  void providerRouter;
  void agentOrchestrator;

  // ── Load memory on startup ─────────────────────────────────────────────────
  memoryStore.load().catch((err) => {
    logError('Failed to load memory store on startup', err);
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  registerExplainFile(context);
  registerShowMemory(context, memoryStore);
  registerClearFileMemory(context, memoryStore);
  registerAskForChange(context, geminiProvider, apiKeyManager, workflowState, memoryStore);
  registerReviewChange(context, workflowState, memoryStore);

  // Set Gemini Key command
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.setGeminiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API key (stored securely in VS Code SecretStorage)',
        password: true,
        placeHolder: 'AIza...',
        ignoreFocusOut: true,
      });
      if (!key) { return; }
      await apiKeyManager.setGeminiKey(key);
      vscode.window.showInformationMessage('Tursiops: Gemini API key saved securely.');
      log('Gemini API key updated.');
    })
  );

  // Clear Gemini Key command
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.clearGeminiKey', async () => {
      await apiKeyManager.clearGeminiKey();
      vscode.window.showInformationMessage('Tursiops: Gemini API key cleared.');
      log('Gemini API key cleared.');
    })
  );

  log(`Tursiops fully activated. Workspace: ${workspaceRoot}`);
}

export function deactivate(): void {
  log('Tursiops deactivated.');
}
