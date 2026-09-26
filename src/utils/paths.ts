import * as vscode from 'vscode';
import * as path from 'path';

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getMemoryFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.agent_memory.json');
}
