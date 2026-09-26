// Tursiops Sidebar — Cline-style full chat UI

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileMemory {
  filePath: string;
  language: string;
  currentHash: string;
  summary: string;
  constraints: string[];
  decisions: string[];
  knownFlaws: string[];
  events: Array<{ timestamp: string; type: string; summary: string; detail?: string }>;
}

interface ActiveFile {
  relativePath: string;
  language: string;
  lineCount: number;
}

interface AgentResponse {
  updatedFile: string;
  summary: string;
  decisions: string[];
  warnings: string[];
  testsToRun: string[];
  confidence: number;
}

interface ValidationResult {
  passed: boolean;
  command: string;
  output: string;
}

type UIStatus = 'idle' | 'thinking' | 'pending' | 'error' | 'validated';

type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'thinking'; attempt: number }
  | { kind: 'response'; response: AgentResponse; attempt: number; awaitingDecision: boolean }
  | { kind: 'correction'; attempt: number }
  | { kind: 'decision'; decision: 'approved' | 'rejected'; summary: string }
  | { kind: 'validation'; typeCheck: ValidationResult; lint: ValidationResult }
  | { kind: 'error'; message: string }
  | { kind: 'info'; text: string };

// ── State ─────────────────────────────────────────────────────────────────────

let chat: ChatEntry[] = [];
let status: UIStatus = 'idle';
let currentFile: ActiveFile | null = null;
let currentMemory: FileMemory | null = null;
let qwenAvailable = false;
let geminiConfigured = false;
let view: 'chat' | 'memory' = 'chat';

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) { return `${d}s ago`; }
  if (d < 3600) { return `${Math.floor(d / 60)}m ago`; }
  if (d < 86400) { return `${Math.floor(d / 3600)}h ago`; }
  return `${Math.floor(d / 86400)}d ago`;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
  const app = document.getElementById('app');
  if (!app) { return; }
  app.innerHTML = view === 'memory' ? buildMemoryView() : buildChatView();
  attachHandlers();
  if (view === 'chat') { scrollToBottom(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT VIEW
// ══════════════════════════════════════════════════════════════════════════════

function buildChatView(): string {
  return `
    <div class="layout">
      ${buildTopBar()}
      <div class="messages" id="messages">
        ${chat.length === 0 ? buildWelcome() : chat.map(buildEntry).join('')}
      </div>
      ${buildInputBar()}
    </div>`;
}

function buildTopBar(): string {
  const fileName = currentFile
    ? currentFile.relativePath.split('/').pop()!
    : null;

  const fileChip = fileName
    ? `<span class="file-chip" title="${esc(currentFile!.relativePath)}">
         <span class="codicon codicon-file"></span>${esc(fileName)}
       </span>`
    : `<span class="file-chip muted">No file open</span>`;

  const memBtn = currentMemory
    ? `<button class="top-btn" id="btn-mem" title="View memory">
         <span class="codicon codicon-database"></span>
         <span class="badge">${currentMemory.events.length}</span>
       </button>`
    : '';

  const settingsBtn = `<button class="top-btn" id="btn-settings" title="Settings">
    <span class="codicon codicon-gear"></span>
  </button>`;

  return `
    <div class="top-bar">
      ${fileChip}
      <div class="top-right">
        ${memBtn}
        ${settingsBtn}
      </div>
    </div>`;
}

function buildWelcome(): string {
  const geminiWarning = !geminiConfigured
    ? `<div class="setup-card" id="btn-set-key">
         <span class="codicon codicon-key"></span>
         <div>
           <strong>Set Gemini API key</strong>
           <p>Required to ask for code changes</p>
         </div>
         <span class="codicon codicon-chevron-right setup-arrow"></span>
       </div>`
    : '';

  const qwenWarning = !qwenAvailable
    ? `<div class="setup-card dimmed">
         <span class="codicon codicon-server"></span>
         <div>
           <strong>Qwen offline</strong>
           <p>Start Ollama for local summarisation</p>
         </div>
       </div>`
    : '';

  const fileHint = !currentFile
    ? `<p class="hint">Open a file in the editor to get started.</p>`
    : '';

  return `
    <div class="welcome">
      <div class="welcome-logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" d="M12 2C7.03 2 3 5.36 3 9.5c0 2.06.9 3.93 2.36 5.3L4 20l5.5-2.5c.8.2 1.63.3 2.5.3 4.97 0 9-3.36 9-7.5S16.97 2 12 2zm0 13c-.72 0-1.42-.08-2.08-.24l-.52-.12-3.27 1.49.75-2.9-.38-.4C5.55 11.98 5 10.78 5 9.5 5 6.46 8.13 4 12 4s7 2.46 7 5.5-3.13 5.5-7 5.5z"/>
          <circle cx="9" cy="9.5" r="1" fill="currentColor"/>
          <circle cx="12" cy="9.5" r="1" fill="currentColor"/>
          <circle cx="15" cy="9.5" r="1" fill="currentColor"/>
        </svg>
      </div>
      <h2 class="welcome-title">What can I do for you?</h2>
      <p class="welcome-sub">Tursiops edits your code, remembers context, and validates changes.</p>

      ${fileHint}
      ${geminiWarning}
      ${qwenWarning}

      ${currentFile ? buildSuggestions() : ''}
    </div>`;
}

function buildSuggestions(): string {
  const suggestions = [
    'Explain this file',
    'Add input validation',
    'Refactor for readability',
    'Add error handling',
  ];
  return `
    <div class="suggestions">
      ${suggestions.map(s => `
        <button class="suggestion-btn" data-prompt="${esc(s)}">
          ${esc(s)}
        </button>`).join('')}
    </div>`;
}

function buildEntry(entry: ChatEntry): string {
  switch (entry.kind) {
    case 'user':
      return `<div class="msg msg-user"><div class="msg-text">${esc(entry.text)}</div></div>`;

    case 'thinking':
      return `
        <div class="msg msg-agent">
          <div class="msg-avatar"><span class="codicon codicon-loading codicon-modifier-spin"></span></div>
          <div class="msg-body">
            <div class="msg-label">Tursiops${entry.attempt > 1 ? ` · attempt ${entry.attempt}/3` : ''}</div>
            <div class="msg-thinking">Thinking…</div>
          </div>
        </div>`;

    case 'correction':
      return `<div class="msg-divider">↩ Correction attempt ${entry.attempt}/3 — fixing errors</div>`;

    case 'response':
      return buildResponseMsg(entry);

    case 'decision':
      return entry.decision === 'approved'
        ? `<div class="msg-status approved"><span class="codicon codicon-check"></span> Applied${entry.summary ? ' — ' + esc(entry.summary) : ''}</div>`
        : `<div class="msg-status rejected"><span class="codicon codicon-close"></span> Rejected — file unchanged</div>`;

    case 'validation': {
      const passed = entry.typeCheck.passed && entry.lint.passed;
      return `<div class="msg-status ${passed ? 'validated' : 'val-fail'}">
        <span class="codicon ${passed ? 'codicon-pass' : 'codicon-error'}"></span>
        ${passed ? 'Validation passed ✓' : `type-check ${entry.typeCheck.passed ? '✓' : '✗'} &nbsp; lint ${entry.lint.passed ? '✓' : '✗'}`}
      </div>`;
    }

    case 'error':
      return `<div class="msg msg-agent">
        <div class="msg-avatar err"><span class="codicon codicon-error"></span></div>
        <div class="msg-body">
          <div class="msg-label">Error</div>
          <div class="msg-error">${esc(entry.message)}</div>
        </div>
      </div>`;

    case 'info':
      return `<div class="msg-info">${esc(entry.text)}</div>`;
  }
}

function buildResponseMsg(entry: Extract<ChatEntry, { kind: 'response' }>): string {
  const r = entry.response;
  const pct = Math.round(r.confidence * 100);

  const warnings = r.warnings.length
    ? r.warnings.map(w => `<div class="resp-warning"><span class="codicon codicon-warning"></span> ${esc(w)}</div>`).join('')
    : '';

  const tags = [...r.decisions, ...r.testsToRun]
    .slice(0, 4)
    .map(t => `<span class="resp-tag">${esc(t)}</span>`)
    .join('');

  const decisionBtns = entry.awaitingDecision
    ? `<div class="decision-row">
        <button class="btn-approve" id="btn-approve">
          <span class="codicon codicon-check"></span> Approve
        </button>
        <button class="btn-reject" id="btn-reject">
          <span class="codicon codicon-close"></span> Reject
        </button>
      </div>`
    : '';

  return `
    <div class="msg msg-agent">
      <div class="msg-avatar t"><span class="agent-t">T</span></div>
      <div class="msg-body">
        <div class="msg-label-row">
          <span class="msg-label">Tursiops</span>
          <span class="confidence">${pct}% confident</span>
        </div>
        <div class="msg-text">${esc(r.summary)}</div>
        ${warnings}
        ${tags ? `<div class="resp-tags">${tags}</div>` : ''}
        ${decisionBtns}
      </div>
    </div>`;
}

function buildInputBar(): string {
  const isThinking = status === 'thinking';
  const noFile = !currentFile;
  const disabled = isThinking || noFile;
  const placeholder = noFile
    ? 'Open a file to get started…'
    : isThinking
      ? 'Waiting for response…'
      : 'Type your task here…';

  return `
    <div class="input-bar">
      <div class="input-wrap ${disabled ? 'disabled' : ''}">
        <textarea
          id="prompt-input"
          class="prompt-input"
          placeholder="${esc(placeholder)}"
          rows="1"
          ${disabled ? 'disabled' : ''}></textarea>
        <div class="input-actions">
          <button class="send-btn" id="send-btn" ${disabled ? 'disabled' : ''} title="Send (Enter)">
            ${isThinking
              ? '<span class="codicon codicon-loading codicon-modifier-spin"></span>'
              : '<span class="codicon codicon-send"></span>'
            }
          </button>
        </div>
      </div>
      <div class="input-footer">
        <span class="provider-dot ${geminiConfigured ? 'ok' : 'warn'}"></span>
        <span class="provider-label">${geminiConfigured ? 'Gemini ready' : 'Gemini key not set'}</span>
        <span class="sep">·</span>
        <span class="provider-dot ${qwenAvailable ? 'ok' : 'off'}"></span>
        <span class="provider-label">${qwenAvailable ? 'Qwen ready' : 'Qwen offline'}</span>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMORY VIEW
// ══════════════════════════════════════════════════════════════════════════════

function buildMemoryView(): string {
  if (!currentMemory) {
    return `
      <div class="layout">
        <div class="top-bar">
          <button class="top-btn" id="btn-back"><span class="codicon codicon-arrow-left"></span></button>
          <span class="top-title">Memory</span>
        </div>
        <div class="empty-view">
          <span class="codicon codicon-database"></span>
          <p>No memory for this file yet.</p>
          <button class="action-btn" id="btn-explain">Run Explain</button>
        </div>
      </div>`;
  }
  const m = currentMemory;
  const fileName = m.filePath.split('/').pop() ?? m.filePath;

  const buildList = (items: string[]) => items.length
    ? items.map(i => `<div class="mem-item">· ${esc(i)}</div>`).join('')
    : `<div class="mem-none">None recorded</div>`;

  const events = [...m.events].reverse().slice(0, 20).map(e => {
    const isFail = e.type === 'validation' && e.summary.toLowerCase().includes('fail');
    const dotCls = isFail ? 'validation fail' : e.type;
    return `<div class="ev-row">
      <span class="ev-dot ${dotCls}"></span>
      <span class="ev-time">${relTime(e.timestamp)}</span>
      <span class="ev-text">${esc(e.summary)}</span>
    </div>`;
  }).join('');

  return `
    <div class="layout">
      <div class="top-bar">
        <button class="top-btn" id="btn-back"><span class="codicon codicon-arrow-left"></span></button>
        <span class="top-title">${esc(fileName)}</span>
        <button class="top-btn" id="btn-export" title="Copy JSON"><span class="codicon codicon-copy"></span></button>
      </div>
      <div class="mem-scroll">
        <div class="mem-section">
          <div class="mem-label">Summary</div>
          <div class="mem-summary">${m.summary ? esc(m.summary) : '<em>No summary yet</em>'}</div>
        </div>
        <div class="mem-section two-col">
          <div>
            <div class="mem-label">Constraints</div>
            ${buildList(m.constraints)}
          </div>
          <div>
            <div class="mem-label">Decisions</div>
            ${buildList(m.decisions)}
          </div>
        </div>
        <div class="mem-section">
          <div class="mem-label">Known Flaws</div>
          ${buildList(m.knownFlaws)}
        </div>
        <div class="mem-section">
          <div class="mem-label">Events (${m.events.length})</div>
          <div class="ev-list">${events || '<div class="mem-none">No events yet</div>'}</div>
        </div>
      </div>
    </div>`;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function attachHandlers(): void {
  // Top bar
  q('#btn-settings')?.addEventListener('click', () => vscode.postMessage({ type: 'setGeminiKey' }));
  q('#btn-mem')?.addEventListener('click', () => { view = 'memory'; render(); });
  q('#btn-back')?.addEventListener('click', () => { view = 'chat'; render(); });
  q('#btn-export')?.addEventListener('click', () => vscode.postMessage({ type: 'exportMemory' }));
  q('#btn-explain')?.addEventListener('click', () => vscode.postMessage({ type: 'explainFile' }));

  // Welcome screen
  q('#btn-set-key')?.addEventListener('click', () => vscode.postMessage({ type: 'setGeminiKey' }));
  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = (btn as HTMLElement).dataset.prompt ?? '';
      if (prompt) { submitPrompt(prompt); }
    });
  });

  // Input
  const input = q('#prompt-input') as HTMLTextAreaElement | null;
  const sendBtn = q('#send-btn') as HTMLButtonElement | null;

  sendBtn?.addEventListener('click', () => sendPrompt());
  input?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
  });
  input?.addEventListener('input', () => {
    if (!input) { return; }
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Chat approve/reject
  q('#btn-approve')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'approveChange' });
    markLastResponseDecided();
    render();
  });
  q('#btn-reject')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'rejectChange' });
    markLastResponseDecided();
    render();
  });
}

function sendPrompt(): void {
  const input = q('#prompt-input') as HTMLTextAreaElement | null;
  const text = input?.value.trim() ?? '';
  if (!text) { return; }
  submitPrompt(text);
  if (input) { input.value = ''; input.style.height = 'auto'; }
}

function submitPrompt(text: string): void {
  if (status === 'thinking' || !currentFile) { return; }
  chat.push({ kind: 'user', text });
  chat.push({ kind: 'thinking', attempt: 1 });
  status = 'thinking';
  vscode.postMessage({ type: 'askForChange', payload: { prompt: text } });
  render();
}

function markLastResponseDecided(): void {
  for (let i = chat.length - 1; i >= 0; i--) {
    const e = chat[i];
    if (e.kind === 'response') { e.awaitingDecision = false; break; }
  }
}

function removeLastOf(kind: ChatEntry['kind']): void {
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i].kind === kind) { chat.splice(i, 1); return; }
  }
}

function q(sel: string): Element | null { return document.querySelector(sel); }

function scrollToBottom(): void {
  const el = document.getElementById('messages');
  if (el) { el.scrollTop = el.scrollHeight; }
}

// ── Message handling ──────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
  const msg = event.data as { type: string; payload: unknown };
  switch (msg.type) {
    case 'activeFileChanged':
      currentFile = msg.payload as ActiveFile | null;
      if (!currentFile) { currentMemory = null; }
      render();
      break;

    case 'memoryUpdated':
      currentMemory = msg.payload as FileMemory | null;
      render();
      break;

    case 'providersStatus': {
      const p = msg.payload as { qwen: boolean; gemini: boolean };
      qwenAvailable = p.qwen;
      geminiConfigured = p.gemini;
      render();
      break;
    }

    case 'geminiResponse': {
      const { response, attempt } = msg.payload as { response: AgentResponse; attempt: number };
      removeLastOf('thinking');
      if (attempt > 1) { chat.push({ kind: 'correction', attempt }); }
      chat.push({ kind: 'response', response, attempt, awaitingDecision: true });
      status = 'pending';
      render();
      break;
    }

    case 'validationResult': {
      const { typeCheck, lint } = msg.payload as { typeCheck: ValidationResult; lint: ValidationResult };
      chat.push({ kind: 'validation', typeCheck, lint });
      status = 'idle';
      render();
      break;
    }

    case 'changeDecision': {
      const { decision, summary } = msg.payload as { decision: 'approved' | 'rejected'; summary: string };
      markLastResponseDecided();
      chat.push({ kind: 'decision', decision, summary });
      if (decision === 'rejected') { status = 'idle'; }
      render();
      break;
    }

    case 'statusUpdate': {
      const s = msg.payload as { status: UIStatus; attempt?: number; message?: string };
      status = s.status;
      if (s.status === 'error' && s.message) {
        removeLastOf('thinking');
        chat.push({ kind: 'error', message: s.message });
        status = 'idle';
      }
      if (s.status === 'thinking' && s.attempt && s.attempt > 1) {
        removeLastOf('thinking');
        chat.push({ kind: 'thinking', attempt: s.attempt });
      }
      render();
      break;
    }
  }
});

render();
