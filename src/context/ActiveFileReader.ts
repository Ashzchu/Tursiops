import * as vscode from 'vscode';

export interface ActiveFile {
  uri: vscode.Uri;
  relativePath: string;
  languageId: string;
  content: string;
  lineCount: number;
}

export function readActiveFile(editor: vscode.TextEditor): ActiveFile {
  return {
    uri: editor.document.uri,
    relativePath: vscode.workspace.asRelativePath(editor.document.uri),
    languageId: editor.document.languageId,
    content: editor.document.getText(),
    lineCount: editor.document.lineCount,
  };
}

export function getActiveEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}
