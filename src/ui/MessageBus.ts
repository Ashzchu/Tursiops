import * as vscode from 'vscode';
import { FileMemory } from '../memory/MemorySchema';
import { AgentResponse } from '../ai/AiSchemas';
import { ValidationResult } from '../validation/ValidationResult';

// ── Messages sent FROM extension TO webview ──────────────────────────────────

export interface MemoryUpdatedMsg {
  type: 'memoryUpdated';
  payload: FileMemory | null;
}

export interface ActiveFileChangedMsg {
  type: 'activeFileChanged';
  payload: { relativePath: string; language: string; lineCount: number } | null;
}

export interface GeminiResponseMsg {
  type: 'geminiResponse';
  payload: { response: AgentResponse; attempt: number };
}

export interface ValidationResultMsg {
  type: 'validationResult';
  payload: { typeCheck: ValidationResult; lint: ValidationResult };
}

export interface ChangeDecisionMsg {
  type: 'changeDecision';
  payload: { decision: 'approved' | 'rejected'; summary: string };
}

export interface StatusUpdateMsg {
  type: 'statusUpdate';
  payload: {
    status: 'idle' | 'thinking' | 'pending' | 'error' | 'validated';
    message?: string;
    attempt?: number;
  };
}

export interface ProvidersStatusMsg {
  type: 'providersStatus';
  payload: { qwen: boolean; gemini: boolean };
}

export type ExtToWebviewMsg =
  | MemoryUpdatedMsg
  | ActiveFileChangedMsg
  | GeminiResponseMsg
  | ValidationResultMsg
  | ChangeDecisionMsg
  | StatusUpdateMsg
  | ProvidersStatusMsg;

// ── Messages sent FROM webview TO extension ───────────────────────────────────

export interface AskForChangeWebMsg {
  type: 'askForChange';
  payload: { prompt: string };
}

export interface ApproveChangeWebMsg {
  type: 'approveChange';
}

export interface RejectChangeWebMsg {
  type: 'rejectChange';
}

export interface ClearMemoryWebMsg {
  type: 'clearMemory';
}

export interface SetGeminiKeyWebMsg {
  type: 'setGeminiKey';
}

export interface ExportMemoryWebMsg {
  type: 'exportMemory';
}

export interface OpenMemoryPanelWebMsg {
  type: 'openMemoryPanel';
}

export interface OpenAskPanelWebMsg {
  type: 'openAskPanel';
}

export interface ExplainFileWebMsg {
  type: 'explainFile';
}

export type WebviewToExtMsg =
  | AskForChangeWebMsg
  | ApproveChangeWebMsg
  | RejectChangeWebMsg
  | ClearMemoryWebMsg
  | SetGeminiKeyWebMsg
  | ExportMemoryWebMsg
  | OpenMemoryPanelWebMsg
  | OpenAskPanelWebMsg
  | ExplainFileWebMsg;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function postToWebview(webview: vscode.Webview, msg: ExtToWebviewMsg): void {
  webview.postMessage(msg);
}

export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
