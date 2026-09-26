import * as vscode from 'vscode';
import { FileMemory } from '../memory/MemorySchema';

export class DecorationManager {
  private decorationType: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;
  private getMemory: (relativePath: string) => FileMemory | undefined;

  constructor(
    context: vscode.ExtensionContext,
    getMemory: (relativePath: string) => FileMemory | undefined
  ) {
    this.context = context;
    this.getMemory = getMemory;
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('icons/tursiops-gutter.svg'),
      gutterIconSize: 'contain',
    });
  }

  refresh(editor?: vscode.TextEditor): void {
    const target = editor ?? vscode.window.activeTextEditor;
    if (!target) { return; }

    const relativePath = vscode.workspace.asRelativePath(target.document.uri);
    const memory = this.getMemory(relativePath);

    if (!memory) {
      target.setDecorations(this.decorationType, []);
      return;
    }

    const lastEvent = memory.events.length > 0
      ? memory.events[memory.events.length - 1]
      : undefined;

    const summarySnippet = memory.summary
      ? memory.summary.slice(0, 120) + (memory.summary.length > 120 ? '…' : '')
      : 'No summary yet';

    const lastChangeStr = lastEvent
      ? `Last event: ${relativeTime(lastEvent.timestamp)} — ${lastEvent.summary}`
      : '';

    const hoverMsg = new vscode.MarkdownString(
      `**Tursiops Memory**\n\n${summarySnippet}\n\n${lastChangeStr}`
    );
    hoverMsg.isTrusted = false;

    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(0, 0, 0, 0),
      hoverMessage: hoverMsg,
    };

    target.setDecorations(this.decorationType, [decoration]);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) { return `${seconds}s ago`; }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  return `${Math.floor(hours / 24)}d ago`;
}
