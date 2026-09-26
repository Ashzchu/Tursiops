import * as vscode from 'vscode';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { getWorkspaceRoot } from '../utils/paths';
import { log } from '../utils/logging';

export function registerShowMemory(
  context: vscode.ExtensionContext,
  store: MemoryStore
): void {
  const disposable = vscode.commands.registerCommand('Tursiops.showMemory', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor.');
      return;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const fileId = getFileId(relativePath);

    await store.load();
    const record = store.get(fileId);

    if (!record) {
      vscode.window.showInformationMessage(
        'No memory for this file yet. Run Explain Current File first.'
      );
      return;
    }

    const channel = vscode.window.createOutputChannel('Tursiops Memory');
    channel.clear();
    channel.appendLine(`=== Memory: ${record.filePath} ===`);
    channel.appendLine(`Summary: ${record.summary}`);
    channel.appendLine('');
    channel.appendLine('Constraints:');
    record.constraints.forEach((c) => channel.appendLine(`  - ${c}`));
    channel.appendLine('');
    channel.appendLine('Decisions:');
    record.decisions.forEach((d) => channel.appendLine(`  - ${d}`));
    channel.appendLine('');
    channel.appendLine('Known Flaws:');
    record.knownFlaws.forEach((f) => channel.appendLine(`  - ${f}`));
    channel.appendLine('');
    channel.appendLine(`Events (${record.events.length} total, last 3):`);
    const lastThree = record.events.slice(-3);
    lastThree.forEach((e) => {
      channel.appendLine(`  [${e.timestamp}] (${e.type}) ${e.summary}${e.detail ? ' — ' + e.detail : ''}`);
    });
    channel.show(true);

    log(`showMemory: displayed memory for ${relativePath}`);
  });

  context.subscriptions.push(disposable);
}
