// Memory Panel webview client script

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

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

let memory: FileMemory | null = null;

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function render(): void {
  const app = document.getElementById('app');
  if (!app) { return; }
  app.innerHTML = memory ? buildMemoryHtml(memory) : buildEmptyHtml();
  attachHandlers();
}

function buildEmptyHtml(): string {
  return `
    <div class="panel">
      <div class="empty-panel">
        <span class="codicon codicon-database"></span>
        <p>No memory recorded for the active file.</p>
        <p style="margin-top:8px;font-size:12px;">Run <strong>Tursiops: Explain Current File</strong> to create memory.</p>
      </div>
    </div>`;
}

function buildMemoryHtml(m: FileMemory): string {
  const fileName = m.filePath.split('/').pop() ?? m.filePath;
  const hashShort = m.currentHash ? m.currentHash.slice(0, 8) : 'none';
  const lang = m.language.charAt(0).toUpperCase() + m.language.slice(1);

  const constraintsList = buildList(m.constraints);
  const decisionsList   = buildList(m.decisions);
  const flawsList       = buildList(m.knownFlaws);
  const eventsList      = buildEventList(m.events);

  return `
    <div class="panel">
      <div class="panel-title">🧠 ${esc(fileName)}</div>
      <div class="panel-subtitle">${esc(m.filePath)} &nbsp;·&nbsp; ${esc(lang)} &nbsp;·&nbsp; Hash: ${esc(hashShort)} &nbsp;·&nbsp; ${m.events.length} events</div>

      <div class="section-header">Summary</div>
      ${m.summary
        ? `<div class="summary-block">${esc(m.summary)}</div>`
        : `<div class="summary-empty">No summary yet — run Explain Current File.</div>`}

      <div class="two-col">
        <div>
          <div class="section-header">Constraints</div>
          <div class="list-section">${constraintsList}</div>
        </div>
        <div>
          <div class="section-header">Decisions</div>
          <div class="list-section">${decisionsList}</div>
        </div>
      </div>

      <div class="section-header">Known Flaws</div>
      <div class="list-section">${flawsList}</div>

      <div class="section-header">
        <div class="events-header">
          Event History
          <button class="export-btn" id="btn-export">
            <span class="codicon codicon-copy"></span> Export JSON
          </button>
        </div>
      </div>
      <div class="event-list">${eventsList}</div>
    </div>`;
}

function buildList(items: string[]): string {
  if (!items || items.length === 0) {
    return `<div class="list-empty">None recorded</div>`;
  }
  return items.map(item => `
    <div class="list-item">
      <span class="list-bullet">·</span>
      <span>${esc(item)}</span>
    </div>`).join('');
}

function buildEventList(events: FileMemory['events']): string {
  if (!events || events.length === 0) {
    return `<div class="list-empty">No events recorded yet.</div>`;
  }
  return [...events].reverse().map((e) => {
    const isValidation = e.type === 'validation';
    const isFail = isValidation && (e.summary.toLowerCase().includes('fail'));
    const dotClass = isValidation && isFail ? 'validation fail' : e.type;
    const badgeClass = isValidation && isFail ? 'validation fail' : e.type;
    const detail = e.detail
      ? `<div class="event-detail"><pre>${esc(e.detail)}</pre></div>`
      : '';
    const expandIcon = e.detail
      ? `<span class="event-expand-icon codicon codicon-chevron-down"></span>`
      : '';

    return `
      <details class="event-row">
        <summary class="event-summary">
          <span class="event-dot ${dotClass}"></span>
          <span class="event-ts">${formatDate(e.timestamp)}</span>
          <span class="event-type-badge ${badgeClass}">${esc(e.type)}</span>
          <span class="event-text" title="${esc(e.summary)}">${esc(e.summary)}</span>
          ${expandIcon}
        </summary>
        ${detail}
      </details>`;
  }).join('');
}

function attachHandlers(): void {
  document.getElementById('btn-export')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'exportMemory' });
  });
}

window.addEventListener('message', (event) => {
  const msg = event.data as { type: string; payload: unknown };
  if (msg.type === 'memoryUpdated') {
    memory = msg.payload as FileMemory | null;
    render();
  }
});

render();
