import * as vscode from 'vscode';
import { getActiveEditor, readActiveFile } from '../context/ActiveFileReader';
import { log, showChannel } from '../utils/logging';

export function registerExplainFile(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('Tursiops.explainFile', () => {
    const editor = getActiveEditor();
    if (!editor) {
      vscode.window.showWarningMessage('Tursiops: No active file open.');
      return;
    }

    const { relativePath, languageId, lineCount } = readActiveFile(editor);

    log(`File: ${relativePath}`);
    log(`Language: ${languageId}`);
    log(`Lines: ${lineCount}`);
    showChannel();

    vscode.window.showInformationMessage(
      `Tursiops: ${relativePath} (${languageId}, ${lineCount} lines)`
    );
  });

  context.subscriptions.push(disposable);
}
