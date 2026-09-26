import * as vscode from 'vscode';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { ApiKeyManager } from '../ai/ApiKeyManager';
import { QwenProvider } from '../ai/QwenProvider';
import { GeminiProvider } from '../ai/GeminiProvider';
import { WorkflowState } from '../orchestrator/WorkflowState';
import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator';
import { getWorkspaceRoot } from '../utils/paths';
import { postToWebview, generateNonce, ExtToWebviewMsg, WebviewToExtMsg } from './MessageBus';
import { StatusBarManager } from './StatusBarManager';
import { log, logError } from '../utils/logging';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'tursiops.sidebarView';

  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];
  private onMemoryChanged: () => void;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly memoryStore: MemoryStore,
    private readonly apiKeyManager: ApiKeyManager,
    private readonly qwenProvider: QwenProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly workflowState: WorkflowState,
    private readonly orchestrator: AgentOrchestrator,
    private readonly statusBar: StatusBarManager,
    onMemoryChanged: () => void,
  ) {
    this.onMemoryChanged = onMemoryChanged;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews'),
        vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
      ],
    };

    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (msg: WebviewToExtMsg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    vscode.window.onDidChangeActiveTextEditor(() => {
      this.pushActiveFile();
      this.pushMemory();
    }, undefined, this.disposables);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.pushProviderStatus();
        this.pushActiveFile();
        this.pushMemory();
      }
    }, undefined, this.disposables);

    this.pushProviderStatus();
    this.pushActiveFile();
    this.pushMemory();

    webviewView.onDidDispose(() => {
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
    }, undefined, this.disposables);
  }

  /** Push a memory refresh to the sidebar (called after any memory write). */
  public notifyMemoryChanged(): void {
    this.pushMemory();
    this.pushProviderStatus();
  }

  /** Forward a message from extension host into the sidebar webview. */
  public post(msg: ExtToWebviewMsg): void {
    if (this.view) {
      postToWebview(this.view.webview, msg);
    }
  }

  private async pushProviderStatus(): Promise<void> {
    const qwen = await this.qwenProvider.isAvailable().catch(() => false);
    const geminiKey = await this.apiKeyManager.getGeminiKey().catch(() => undefined);
    this.post({ type: 'providersStatus', payload: { qwen, gemini: !!geminiKey } });
    this.statusBar.updateTooltip(qwen, !!geminiKey);
  }

  private pushActiveFile(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.post({ type: 'activeFileChanged', payload: null });
      return;
    }
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    this.post({
      type: 'activeFileChanged',
      payload: {
        relativePath,
        language: editor.document.languageId,
        lineCount: editor.document.lineCount,
      },
    });
  }

  private pushMemory(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.post({ type: 'memoryUpdated', payload: null });
      return;
    }
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const memory = this.memoryStore.get(getFileId(relativePath)) ?? null;
    this.post({ type: 'memoryUpdated', payload: memory });
  }

  private handleMessage(msg: WebviewToExtMsg): void {
    switch (msg.type) {
      case 'askForChange':
        void this.runAsk(msg.payload.prompt);
        break;
      case 'approveChange':
        vscode.commands.executeCommand('Tursiops.reviewChange');
        break;
      case 'rejectChange':
        this.workflowState.clear();
        this.post({ type: 'changeDecision', payload: { decision: 'rejected', summary: '' } });
        this.statusBar.setIdle();
        break;
      case 'explainFile':
        vscode.commands.executeCommand('Tursiops.explainFile');
        break;
      case 'setGeminiKey':
        vscode.commands.executeCommand('Tursiops.setGeminiKey');
        break;
      case 'clearMemory':
        vscode.commands.executeCommand('Tursiops.clearFileMemory');
        break;
      case 'exportMemory': {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
          const memory = this.memoryStore.get(getFileId(relativePath));
          if (memory) {
            vscode.env.clipboard.writeText(JSON.stringify(memory, null, 2));
            vscode.window.showInformationMessage('Tursiops: Memory copied to clipboard.');
          }
        }
        break;
      }
      case 'openMemoryPanel':
        vscode.commands.executeCommand('Tursiops.openMemoryPanel');
        break;
      case 'openAskPanel':
        // In the new design, Ask is inline in the sidebar — nothing to do
        break;
      default:
        log('Sidebar: unhandled message type');
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

    // Ensure Gemini key
    let key = await this.apiKeyManager.getGeminiKey();
    if (!key) {
      const entered = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API key',
        password: true,
        placeHolder: 'AIza…',
        ignoreFocusOut: true,
      });
      if (!entered) {
        this.post({ type: 'statusUpdate', payload: { status: 'idle' } });
        return;
      }
      await this.apiKeyManager.setGeminiKey(entered);
      key = entered;
      void this.pushProviderStatus();
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const fileId = getFileId(relativePath);
    const originalContent = editor.document.getText();
    const language = editor.document.languageId;

    await this.memoryStore.load();
    const memory = this.memoryStore.getOrCreate(fileId, relativePath, language);

    this.statusBar.setThinking(1);

    log(`Sidebar: sending request to Gemini: "${userPrompt}"`);

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
            this.post({ type: 'geminiResponse', payload: { response, attempt } });
            this.statusBar.setThinking(attempt);
          },
          onValidationResult: (typeCheck, lint) => {
            this.post({ type: 'validationResult', payload: { typeCheck, lint } });
            const eventCount = this.memoryStore.get(fileId)?.events.length;
            this.statusBar.setValidated(typeCheck.passed && lint.passed, eventCount);
            this.onMemoryChanged();
          },
          onChangeDecision: (decision, summary) => {
            this.post({ type: 'changeDecision', payload: { decision, summary } });
            if (decision === 'approved') { this.onMemoryChanged(); }
          },
        },
      });
    } catch (err) {
      logError('Sidebar ask error', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      this.post({ type: 'statusUpdate', payload: { status: 'error', message: errMsg } });
      this.statusBar.setError(errMsg.slice(0, 60));
      return;
    }

    const eventCount = this.memoryStore.get(fileId)?.events.length;
    this.statusBar.setIdle(eventCount);
    this.post({ type: 'statusUpdate', payload: { status: 'idle' } });
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = generateNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'sidebar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'sidebar.css')
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
  <title>Tursiops</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
