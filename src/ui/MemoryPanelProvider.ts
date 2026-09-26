import * as vscode from 'vscode';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { postToWebview, generateNonce } from './MessageBus';
import { log } from '../utils/logging';

export class MemoryPanelProvider {
  private static currentPanel: MemoryPanelProvider | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static open(
    context: vscode.ExtensionContext,
    memoryStore: MemoryStore
  ): void {
    const editor = vscode.window.activeTextEditor;
    const column = editor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;

    if (MemoryPanelProvider.currentPanel) {
      MemoryPanelProvider.currentPanel.panel.reveal(column);
      MemoryPanelProvider.currentPanel.refresh(memoryStore);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'tursiops.memoryPanel',
      'Tursiops Memory',
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

    MemoryPanelProvider.currentPanel = new MemoryPanelProvider(panel, context, memoryStore);
  }

  /** Called externally when memory changes to push updates to the panel. */
  public static notifyMemoryChanged(memoryStore: MemoryStore): void {
    MemoryPanelProvider.currentPanel?.refresh(memoryStore);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    memoryStore: MemoryStore
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
      (msg: { type: string }) => {
        if (msg.type === 'exportMemory') {
          this.handleExport(memoryStore);
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);

    this.refresh(memoryStore);
  }

  private refresh(memoryStore: MemoryStore): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      postToWebview(this.panel.webview, { type: 'memoryUpdated', payload: null });
      return;
    }
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const fileId = getFileId(relativePath);
    const memory = memoryStore.get(fileId) ?? null;
    postToWebview(this.panel.webview, { type: 'memoryUpdated', payload: memory });

    if (memory) {
      this.panel.title = `Memory — ${relativePath.split('/').pop()}`;
    }
  }

  private handleExport(memoryStore: MemoryStore): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const fileId = getFileId(relativePath);
    const memory = memoryStore.get(fileId);
    if (memory) {
      vscode.env.clipboard.writeText(JSON.stringify(memory, null, 2));
      vscode.window.showInformationMessage('Tursiops: Memory JSON copied to clipboard.');
      log('Memory exported to clipboard.');
    }
  }

  private buildHtml(): string {
    const nonce = generateNonce();
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'memory.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'memory.css')
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
  <title>Tursiops Memory</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    MemoryPanelProvider.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
