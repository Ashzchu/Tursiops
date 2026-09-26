import * as vscode from 'vscode';

let _channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!_channel) {
    _channel = vscode.window.createOutputChannel('Tursiops');
  }
  return _channel;
}

export function log(msg: string): void {
  getChannel().appendLine(`[Tursiops] ${msg}`);
}

export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : String(err ?? '');
  getChannel().appendLine(`[Tursiops][ERROR] ${msg}${detail ? ': ' + detail : ''}`);
  // NEVER log API keys, full file content, or raw model responses
}

export function showChannel(): void {
  getChannel().show(true);
}
