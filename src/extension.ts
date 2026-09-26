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
import { getFileId } from './memory/FileIdentity';

import { SidebarProvider } from './ui/SidebarProvider';
import { MemoryPanelProvider } from './ui/MemoryPanelProvider';
import { AskPanelProvider } from './ui/AskPanelProvider';
import { StatusBarManager } from './ui/StatusBarManager';
import { DecorationManager } from './ui/DecorationManager';

export function activate(context: vscode.ExtensionContext): void {
  log('Tursiops is now active.');

  // ── Workspace trust guard ──────────────────────────────────────────────────
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      'Tursiops: This workspace is not trusted. AI features are disabled.'
    );
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
  void providerRouter;

  // ── Load memory on startup ─────────────────────────────────────────────────
  memoryStore.load().catch((err) => {
    logError('Failed to load memory store on startup', err);
  });

  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebarProvider = new SidebarProvider(
    context, memoryStore, apiKeyManager, qwenProvider,
    geminiProvider, workflowState, agentOrchestrator,
    statusBar, onMemoryChanged
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewId,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Callback to notify UI layers when memory changes
  function onMemoryChanged(): void {
    sidebarProvider.notifyMemoryChanged();
    MemoryPanelProvider.notifyMemoryChanged(memoryStore);
    // Refresh decoration for active file
    decorationManager.refresh();
    // Update status bar event count
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      const mem = memoryStore.get(getFileId(relativePath));
      statusBar.setIdle(mem?.events.length);
    }
  }

  // ── Editor decorations ─────────────────────────────────────────────────────
  const decorationManager = new DecorationManager(
    context,
    (relativePath: string) => memoryStore.get(getFileId(relativePath))
  );
  context.subscriptions.push({ dispose: () => decorationManager.dispose() });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      decorationManager.refresh(editor);
      if (editor) {
        const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
        const mem = memoryStore.get(getFileId(relativePath));
        statusBar.setIdle(mem?.events.length);
      } else {
        statusBar.setIdle();
      }
    })
  );

  // ── Commands ───────────────────────────────────────────────────────────────
  registerExplainFile(context);
  registerShowMemory(context, memoryStore);
  registerClearFileMemory(context, memoryStore);
  registerAskForChange(context, geminiProvider, apiKeyManager, workflowState, memoryStore);
  registerReviewChange(context, workflowState, memoryStore);

  // Open sidebar focus command
  context.subscriptions.push(
    vscode.commands.registerCommand('tursiops.openSidebar', () => {
      vscode.commands.executeCommand('tursiops.sidebarView.focus');
    })
  );

  // Memory panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.openMemoryPanel', () => {
      MemoryPanelProvider.open(context, memoryStore);
    })
  );

  // Ask panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.openAskPanel', () => {
      AskPanelProvider.open(
        context, memoryStore, apiKeyManager, geminiProvider,
        workflowState, agentOrchestrator, statusBar, onMemoryChanged
      );
    })
  );

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
      // Refresh provider status in sidebar
      sidebarProvider.notifyMemoryChanged();
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

  // Initial decoration pass
  decorationManager.refresh();

  log(`Tursiops fully activated. Workspace: ${workspaceRoot}`);
}

export function deactivate(): void {
  log('Tursiops deactivated.');
}
