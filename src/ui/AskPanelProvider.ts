import * as vscode from 'vscode';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { ApiKeyManager } from '../ai/ApiKeyManager';
import { GeminiProvider } from '../ai/GeminiProvider';
import { WorkflowState } from '../orchestrator/WorkflowState';
import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator';
import { getWorkspaceRoot } from '../utils/paths';
import { postToWebview, generateNonce, WebviewToExtMsg } from './MessageBus';
import { log, logError } from '../utils/logging';
import { StatusBarManager } from './StatusBarManager';

export class AskPanelProvider {
  private static currentPanel: AskPanelProvider | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static open(
    context: vscode.ExtensionContext,
    memoryStore: MemoryStore,
    apiKeyManager: ApiKeyManager,
    geminiProvider: GeminiProvider,
    workflowState: WorkflowState,
    orchestrator: AgentOrchestrator,
    statusBar: StatusBarManager,
    onMemoryChanged: () => void,
  ): void {
    const column = vscode.ViewColumn.Active;

    if (AskPanelProvider.currentPanel) {
      AskPanelProvider.currentPanel.panel.reveal(column);
      AskPanelProvider.currentPanel.pushContext(memoryStore, workflowState);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'tursiops.askPanel',
      'Tursiops — Ask for Change',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews'),
          vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
        ],
      }
    );

    AskPanelProvider.currentPanel = new AskPanelProvider(
      panel, context, memoryStore, apiKeyManager,
      geminiProvider, workflowState, orchestrator,
      statusBar, onMemoryChanged
    );
  }

  public static notifyPendingChange(hasPending: boolean): void {
    if (!AskPanelProvider.currentPanel) { return; }
    postToWebview(AskPanelProvider.currentPanel.panel.webview, {
      type: 'statusUpdate',
      payload: { status: hasPending ? 'pending' : 'idle' },
    });
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly memoryStore: MemoryStore,
    private readonly apiKeyManager: ApiKeyManager,
    private readonly geminiProvider: GeminiProvider,
    private readonly workflowState: WorkflowState,
    private readonly orchestrator: AgentOrchestrator,
    private readonly statusBar: StatusBarManager,
    private readonly onMemoryChanged: () => void,
  ) {
    this.panel = panel;
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews'),
        vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
      ],
    };
    this.panel.webview.html = this.buildHtml();

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtMsg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);

    this.pushContext(memoryStore, workflowState);
  }

  private pushContext(memoryStore: MemoryStore, workflowState: WorkflowState): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      postToWebview(this.panel.webview, { type: 'activeFileChanged', payload: null });
      return;
    }
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    postToWebview(this.panel.webview, {
      type: 'activeFileChanged',
      payload: {
        relativePath,
        language: editor.document.languageId,
        lineCount: editor.document.lineCount,
      },
    });

    const fileId = getFileId(relativePath);
    const memory = memoryStore.get(fileId) ?? null;
    postToWebview(this.panel.webview, { type: 'memoryUpdated', payload: memory });

    if (workflowState.pendingResponse) {
      postToWebview(this.panel.webview, {
        type: 'statusUpdate',
        payload: { status: 'pending' },
      });
    }
  }

  private async handleMessage(msg: WebviewToExtMsg): Promise<void> {
    switch (msg.type) {
      case 'askForChange':
        await this.runAsk(msg.payload.prompt);
        break;
      case 'approveChange':
        await this.handleApprove();
        break;
      case 'rejectChange':
        this.handleReject();
        break;
      case 'setGeminiKey':
        vscode.commands.executeCommand('Tursiops.setGeminiKey');
        break;
      default:
        break;
    }
  }

  private async runAsk(userPrompt: string): Promise<void> {
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

    // Ensure key
    let key = await this.apiKeyManager.getGeminiKey();
    if (!key) {
      const entered = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API key',
        password: true,
        placeHolder: 'AIza…',
        ignoreFocusOut: true,
      });
      if (!entered) { return; }
      await this.apiKeyManager.setGeminiKey(entered);
      key = entered;
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const fileId = getFileId(relativePath);
    const originalContent = editor.document.getText();
    const language = editor.document.languageId;

    await this.memoryStore.load();
    const memory = this.memoryStore.getOrCreate(fileId, relativePath, language);

    this.statusBar.setThinking(1);
    postToWebview(this.panel.webview, {
      type: 'statusUpdate',
      payload: { status: 'thinking', attempt: 1 },
    });

    log(`Ask panel: sending request to Gemini: "${userPrompt}"`);

    try {
      await this.orchestrator.runWithValidation({
        activeFileUri: editor.document.uri,
        activeFilePath: relativePath,
        language,
        originalContent,
        memory,
        fileId,
        userPrompt,
        geminiProvider: this.geminiProvider,
        workflowState: this.workflowState,
        memoryStore: this.memoryStore,
        workspaceRoot,
        uiCallbacks: {
          onGeminiResponse: (response, attempt) => {
            postToWebview(this.panel.webview, {
              type: 'geminiResponse',
              payload: { response, attempt },
            });
            this.statusBar.setThinking(attempt);
            postToWebview(this.panel.webview, {
              type: 'statusUpdate',
              payload: { status: 'thinking', attempt },
            });
          },
          onValidationResult: (typeCheck, lint) => {
            postToWebview(this.panel.webview, {
              type: 'validationResult',
              payload: { typeCheck, lint },
            });
            const passed = typeCheck.passed && lint.passed;
            const eventCount = this.memoryStore.get(fileId)?.events.length;
            this.statusBar.setValidated(passed, eventCount);
          },
          onChangeDecision: (decision, summary) => {
            postToWebview(this.panel.webview, {
              type: 'changeDecision',
              payload: { decision, summary },
            });
            if (decision === 'approved') {
              this.onMemoryChanged();
            }
          },
        },
      });
    } catch (err) {
      logError('Ask panel orchestrator error', err);
      const msg = err instanceof Error ? err.message : String(err);
      postToWebview(this.panel.webview, {
        type: 'statusUpdate',
        payload: { status: 'error', message: msg },
      });
      this.statusBar.setError(msg.slice(0, 60));
      return;
    }

    const eventCount = this.memoryStore.get(fileId)?.events.length;
    this.statusBar.setIdle(eventCount);
    postToWebview(this.panel.webview, {
      type: 'statusUpdate',
      payload: { status: 'idle' },
    });
  }

  private async handleApprove(): Promise<void> {
    // Approval is handled inside AgentOrchestrator via the diff dialog.
    // The ask panel's Approve button re-runs reviewChange for any pending state.
    vscode.commands.executeCommand('Tursiops.reviewChange');
  }

  private handleReject(): void {
    this.workflowState.clear();
    postToWebview(this.panel.webview, {
      type: 'changeDecision',
      payload: { decision: 'rejected', summary: '' },
    });
    this.statusBar.setIdle();
  }

  private buildHtml(): string {
    const nonce = generateNonce();
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'ask.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'ask.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'
      )
    );
    const csp = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${csp} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             font-src ${csp};
             img-src ${csp} data:;">
  <link rel="stylesheet" href="${codiconsUri}">
  <link rel="stylesheet" href="${styleUri}">
  <title>Tursiops — Ask for Change</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    AskPanelProvider.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
