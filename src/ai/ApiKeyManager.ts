import * as vscode from 'vscode';

const GEMINI_KEY_SECRET = 'tursiops.geminiApiKey';

export class ApiKeyManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getGeminiKey(): Promise<string | undefined> {
    return this.secrets.get(GEMINI_KEY_SECRET);
  }

  async setGeminiKey(key: string): Promise<void> {
    await this.secrets.store(GEMINI_KEY_SECRET, key);
  }

  async clearGeminiKey(): Promise<void> {
    await this.secrets.delete(GEMINI_KEY_SECRET);
  }
}
