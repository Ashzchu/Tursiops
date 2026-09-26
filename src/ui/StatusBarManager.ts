import * as vscode from 'vscode';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private revertTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'tursiops.openSidebar';
    this.item.text = '$(comment-discussion) Tursiops';
    this.item.tooltip = 'Tursiops — click to open panel';
    this.item.show();
  }

  setIdle(eventCount?: number): void {
    this.clearRevertTimer();
    this.item.text =
      eventCount !== undefined && eventCount > 0
        ? `$(comment-discussion) ${eventCount} events`
        : '$(comment-discussion) Tursiops';
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }

  setThinking(attempt?: number): void {
    this.clearRevertTimer();
    const suffix = attempt && attempt > 1 ? ` (${attempt}/3)` : '';
    this.item.text = `$(loading~spin) Thinking…${suffix}`;
    this.item.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
    this.item.color = undefined;
  }

  setPending(): void {
    this.clearRevertTimer();
    this.item.text = '$(circle-filled) Review pending';
    this.item.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
    this.item.color = undefined;
  }

  setError(msg?: string): void {
    this.clearRevertTimer();
    this.item.text = `$(warning) ${msg ?? 'Error'}`;
    this.item.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground'
    );
    this.item.color = undefined;
    // Auto-revert after 6 seconds
    this.revertTimer = setTimeout(() => this.setIdle(), 6000);
  }

  setValidated(passed: boolean, eventCount?: number): void {
    this.clearRevertTimer();
    if (passed) {
      this.item.text = '$(pass) Validated';
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(error) Needs fix';
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    }
    // Revert after 4 seconds
    this.revertTimer = setTimeout(() => this.setIdle(eventCount), 4000);
  }

  updateTooltip(qwen: boolean, gemini: boolean): void {
    const qwenStr = qwen ? '● available' : '○ offline';
    const geminiStr = gemini ? '✓ key configured' : '⚠ key not set';
    this.item.tooltip = `Tursiops\nQwen: ${qwenStr}\nGemini: ${geminiStr}`;
  }

  dispose(): void {
    this.clearRevertTimer();
    this.item.dispose();
  }

  private clearRevertTimer(): void {
    if (this.revertTimer !== undefined) {
      clearTimeout(this.revertTimer);
      this.revertTimer = undefined;
    }
  }
}
