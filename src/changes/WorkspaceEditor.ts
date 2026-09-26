import * as vscode from 'vscode';

export async function applyChange(uri: vscode.Uri, newContent: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  // Get the document to find its full range
  const doc = await vscode.workspace.openTextDocument(uri);
  const fullRange = new vscode.Range(
    doc.lineAt(0).range.start,
    doc.lineAt(doc.lineCount - 1).range.end
  );
  edit.replace(uri, fullRange, newContent);
  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    throw new Error('WorkspaceEdit failed to apply. The file may be read-only or locked.');
  }
}
