import * as vscode from 'vscode';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { getWorkspaceRoot } from '../utils/paths';
import { log } from '../utils/logging';

export function registerClearFileMemory(
  context: vscode.ExtensionContext,
  store: MemoryStore
): void {
  const disposable = vscode.commands.registerCommand('Tursiops.clearFileMemory', async () => {
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

    store.remove(fileId);
    await store.save();

    vscode.window.showInformationMessage('Memory cleared for this file.');
    log(`clearFileMemory: cleared memory for ${relativePath}`);
  });

  context.subscriptions.push(disposable);
}
