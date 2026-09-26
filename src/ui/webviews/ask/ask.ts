// Ask for Change Panel — webview client script

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ActiveFile {
  relativePath: string;
  language: string;
  lineCount: number;
}

interface FileMemory {
  summary: string;
  constraints: string[];
  decisions: string[];
  knownFlaws: string[];
  events: Array<{ timestamp: string; type: string; summary: string }>;
}

type UIStatus = 'idle' | 'thinking' | 'pending' | 'error' | 'validated';

// ── State ─────────────────────────────────────────────────────────────────────

type LogEntry =
  | { kind: 'user'; text: string }
  | { kind: 'response'; response: AgentResponse; attempt: number; awaitingDecision: boolean }
  | { kind: 'thinking'; attempt: number }
  | { kind: 'decision'; decision: 'approved' | 'rejected'; summary: string }
  | { kind: 'validation'; typeCheck: ValidationResult; lint: ValidationResult }
  | { kind: 'correction'; attempt: number }
  | { kind: 'error'; message: string };

let log: LogEntry[] = [];
let status: UIStatus = 'idle';
let currentFile: ActiveFile | null = null;
let currentMemory: FileMemory | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
  const app = document.getElementById('app');
  if (!app) { return; }
  app.innerHTML = buildHtml();
  attachHandlers();
  scrollToBottom();
}

function buildHtml(): string {
  return `
    ${buildContextBar()}
    <div class="conversation" id="conversation">
      ${log.length === 0 ? buildEmptyConvo() : log.map(buildEntry).join('')}
    </div>
    ${buildInputRow()}`;
}

function buildContextBar(): string {
  if (!currentFile) {
    return `<div class="context-bar"><span class="context-file">No file open</span></div>`;
  }
  const lang = currentFile.language.charAt(0).toUpperCase() + currentFile.language.slice(1);
  const memorySummary = currentMemory?.summary
    ? `<span class="context-sep">·</span><span title="${esc(currentMemory.summary)}">Memory: ${currentMemory.events.length} events</span>`
    : '';
  return `
    <div class="context-bar">
      <span class="context-file">${esc(currentFile.relativePath)}</span>
      <span class="context-sep">·</span>
      <span>${esc(lang)}</span>
      <span class="context-sep">·</span>
      <span>${currentFile.lineCount} lines</span>
      ${memorySummary}
    </div>`;
}

function buildEmptyConvo(): string {
  return `
    <div class="empty-convo">
      <span class="codicon codicon-comment-discussion"></span>
      <p>Ask Tursiops to make a change to the active file.</p>
      <p>Type your request below and press <strong>Send</strong>.</p>
    </div>`;
}

function buildEntry(entry: LogEntry): string {
  switch (entry.kind) {
    case 'user':
      return `
        <div class="bubble-user">
          <div class="bubble-header">YOU</div>
          <div>${esc(entry.text)}</div>
        </div>`;

    case 'thinking':
      return `
        <div class="bubble-status thinking">
          <span class="codicon codicon-loading codicon-modifier-spin"></span>
          Waiting for Gemini… Attempt ${entry.attempt}/3
        </div>`;

    case 'correction':
      return `<div class="correction-notice">↩ Correction attempt ${entry.attempt}/3 — fixing errors</div>`;

    case 'response':
      return buildResponseBubble(entry);

    case 'decision':
      return buildDecisionBadge(entry);

    case 'validation':
      return buildValidationBadge(entry);

    case 'error':
      return `<div class="error-bubble"><span class="codicon codicon-error"></span> ${esc(entry.message)}</div>`;
  }
}

function buildResponseBubble(entry: Extract<LogEntry, { kind: 'response' }>): string {
  const r = entry.response;
  const pct = Math.round(r.confidence * 100);
  const fillWidth = `${pct}%`;

  const warnings = r.warnings.length > 0
    ? r.warnings.map(w => `<div class="response-warning"><span class="codicon codicon-warning"></span>${esc(w)}</div>`).join('')
    : '';

  const tests = r.testsToRun.length > 0
    ? `<div class="response-section"><strong>Tests to run:</strong> ${r.testsToRun.map(t => `<span class="response-tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  const decisions = r.decisions.length > 0
    ? `<div class="response-section"><strong>Decisions:</strong> ${r.decisions.map(d => `<span class="response-tag">${esc(d)}</span>`).join('')}</div>`
    : '';

  const decisionButtons = entry.awaitingDecision
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
    <div class="bubble-gemini">
      <div class="bubble-header-row">
        <span class="bubble-header">GEMINI</span>
        <div class="confidence-wrap">
          <div class="confidence-track">
            <div class="confidence-fill" style="width:${fillWidth}"></div>
          </div>
          <span>${pct}%</span>
        </div>
      </div>
      <div class="response-summary">${esc(r.summary)}</div>
      ${warnings}
      ${decisions}
      ${tests}
      ${decisionButtons}
    </div>`;
}

function buildDecisionBadge(entry: Extract<LogEntry, { kind: 'decision' }>): string {
  if (entry.decision === 'approved') {
    return `<div class="decision-badge approved"><span class="codicon codicon-check"></span> Approved${entry.summary ? ' — ' + esc(entry.summary) : ''}</div>`;
  }
  return `<div class="decision-badge rejected"><span class="codicon codicon-close"></span> Rejected — file unchanged</div>`;
}

function buildValidationBadge(entry: Extract<LogEntry, { kind: 'validation' }>): string {
  const { typeCheck, lint } = entry;
  const passed = typeCheck.passed && lint.passed;
  const cls = passed ? 'pass' : 'fail';
  const icon = passed ? 'codicon-pass' : 'codicon-error';
  const tcLabel = typeCheck.passed ? 'type-check ✓' : 'type-check ✗';
  const lintLabel = lint.passed ? 'lint ✓' : 'lint ✗';
  return `<div class="validation-badge ${cls}"><span class="codicon ${icon}"></span> ${tcLabel} &nbsp; ${lintLabel}</div>`;
}

function buildInputRow(): string {
  const isThinking = status === 'thinking';
  return `
    <div class="input-row">
      <textarea
        class="prompt-input"
        id="prompt-input"
        placeholder="What change should Tursiops make?"
        rows="1"
        ${isThinking ? 'disabled' : ''}></textarea>
      <button class="send-btn" id="send-btn" ${isThinking ? 'disabled' : ''}>
        ${isThinking
          ? '<span class="codicon codicon-loading codicon-modifier-spin"></span>'
          : '<span class="codicon codicon-send"></span>'
        }
        ${isThinking ? 'Thinking…' : 'Send'}
      </button>
    </div>`;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function attachHandlers(): void {
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement | null;
  const input = document.getElementById('prompt-input') as HTMLTextAreaElement | null;

  sendBtn?.addEventListener('click', () => sendPrompt());
  input?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });
  // Auto-resize textarea
  input?.addEventListener('input', () => {
    if (!input) { return; }
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  document.getElementById('btn-approve')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'approveChange' });
    // Mark the last response bubble as no longer awaiting
    markResponseDecided();
  });

  document.getElementById('btn-reject')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'rejectChange' });
    markResponseDecided();
  });
}

function markResponseDecided(): void {
  // Remove awaitingDecision flag from the last response entry
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.kind === 'response') {
      (entry as Extract<LogEntry, { kind: 'response' }>).awaitingDecision = false;
      break;
    }
  }
}

function sendPrompt(): void {
  const input = document.getElementById('prompt-input') as HTMLTextAreaElement | null;
  const text = input?.value.trim();
  if (!text || status === 'thinking') { return; }

  log.push({ kind: 'user', text });
  log.push({ kind: 'thinking', attempt: 1 });
  status = 'thinking';

  vscode.postMessage({ type: 'askForChange', payload: { prompt: text } });

  if (input) { input.value = ''; input.style.height = 'auto'; }
  render();
}

function scrollToBottom(): void {
  const convo = document.getElementById('conversation');
  if (convo) {
    convo.scrollTop = convo.scrollHeight;
  }
}

// ── Message handling ──────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
  const msg = event.data as { type: string; payload: unknown };

  switch (msg.type) {
    case 'activeFileChanged':
      currentFile = msg.payload as ActiveFile | null;
      render();
      break;

    case 'memoryUpdated':
      currentMemory = msg.payload as FileMemory | null;
      render();
      break;

    case 'geminiResponse': {
      const { response, attempt } = msg.payload as { response: AgentResponse; attempt: number };
      // Remove the thinking entry
      removeLastOf('thinking');
      // Add correction notice if attempt > 1
      if (attempt > 1) {
        log.push({ kind: 'correction', attempt });
      }
      log.push({ kind: 'response', response, attempt, awaitingDecision: true });
      status = 'pending';
      render();
      break;
    }

    case 'validationResult': {
      const { typeCheck, lint } = msg.payload as { typeCheck: ValidationResult; lint: ValidationResult };
      log.push({ kind: 'validation', typeCheck, lint });
      status = 'idle';
      render();
      break;
    }

    case 'changeDecision': {
      const { decision, summary } = msg.payload as { decision: 'approved' | 'rejected'; summary: string };
      markResponseDecided();
      log.push({ kind: 'decision', decision, summary });
      if (decision === 'rejected') { status = 'idle'; }
      render();
      break;
    }

    case 'statusUpdate': {
      const s = msg.payload as { status: UIStatus; attempt?: number; message?: string };
      status = s.status;
      if (s.status === 'error' && s.message) {
        removeLastOf('thinking');
        log.push({ kind: 'error', message: s.message });
        status = 'idle';
      }
      if (s.status === 'thinking' && s.attempt && s.attempt > 1) {
        removeLastOf('thinking');
        log.push({ kind: 'thinking', attempt: s.attempt });
      }
      render();
      break;
    }
  }
});

function removeLastOf(kind: LogEntry['kind']): void {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].kind === kind) {
      log.splice(i, 1);
      return;
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

render();
