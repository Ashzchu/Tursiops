# Tursiops — UI Design Specification

## Design Philosophy

1. **Native VS Code feel** — Panels look like VS Code built-ins, not a standalone app embedded in a frame.
2. **Zero configuration to see value** — The sidebar shows useful information (file name, memory summary, event count) even before the user has typed a single prompt.
3. **Progressive disclosure** — Simple summary up front, full detail on demand.
4. **No hiding complexity behind chrome** — The AI confidence score, validation pass/fail, and retry count are always visible; nothing is silently swallowed.
5. **Security visible, not hidden** — Key status is shown ("Gemini: ✓ configured" or "⚠ not set") so users never wonder why a command silently failed.

---

## Sidebar Panel — Full Spec

### Anatomy

```
┌─────────────────────────────────────────────┐
│  TURSIOPS                          [⚙]  [?] │  ← Header
├─────────────────────────────────────────────┤
│  ● Qwen available   ○ Gemini not configured │  ← Provider Bar
├─────────────────────────────────────────────┤
│  📄 askForChange.ts                          │  ← Active File Card
│  TypeScript · 137 lines                     │
├─────────────────────────────────────────────┤
│  MEMORY                              [→ ]   │  ← Memory Card header
│  ─────────────────────────────────────────  │
│  Handles the Gemini-backed "Ask for         │
│  Change" flow: key validation, prompt…      │  ← Summary (3 lines max)
│  ── ── ── ── ── ── ── ── ── ── ── ── ──   │
│  [Constraints 2] [Decisions 3]              │
│  [Known Flaws 1] [Events 7]                 │  ← Stat chips
├─────────────────────────────────────────────┤
│  [✏ Ask for Change]  [👁 Review] (pulse)   │  ← Primary Actions
│  [🧠 Full Memory]    [🗑 Clear]             │  ← Secondary Actions
├─────────────────────────────────────────────┤
│  RECENT EVENTS                              │  ← Event Feed (collapse)
│  ● change   2 min ago   Added validation   │
│  ● validate 2 min ago   ✓ type-check lint  │
│  ● summary  1 hr ago    Initial summary    │
│                              [view all →]  │
└─────────────────────────────────────────────┘
```

### Header

| Element | Detail |
|---------|--------|
| Title `TURSIOPS` | `font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--vscode-sideBarTitle-foreground)` — matches VS Code section headers |
| Settings icon `[⚙]` | Codicon `$(gear)`; click → `Tursiops.setGeminiKey` |
| Help icon `[?]` | Codicon `$(question)`; click → opens `README.md` in preview |

### Provider Status Bar

A single horizontal row, two cells.

```css
.provider-bar {
  display: flex;
  gap: 12px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-widget-border);
}
.provider-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.provider-dot.available  { background: #22c55e; }
.provider-dot.unavailable { background: var(--vscode-descriptionForeground); opacity: 0.4; }
.provider-dot.error      { background: #ef4444; }
```

States:
- **Qwen available** — green dot, label `Qwen available`
- **Qwen unavailable** — grey dot, label `Qwen offline`
- **Gemini configured** — green dot, label `Gemini ✓`
- **Gemini not set** — red dot, label `Gemini: set key` (clickable → setGeminiKey)

Provider status is polled once on sidebar mount: `QwenProvider.isAvailable()` result sent via `statusUpdate` message, Gemini status via `ApiKeyManager.getGeminiKey() !== undefined`.

### Active File Card

```css
.active-file-card {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--vscode-widget-border);
}
.file-icon { /* codicon language icon */ }
.file-name {
  font-weight: 500;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.file-meta {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}
```

Empty state when no file is open:
```html
<div class="empty-state">
  <span class="codicon codicon-file"></span>
  <p>Open a file to see its memory</p>
</div>
```

### Memory Card

```css
.memory-card {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vscode-widget-border);
}
.memory-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vscode-sideBarSectionHeader-foreground);
}
.summary-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--vscode-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.summary-text.expanded { -webkit-line-clamp: unset; }
.stat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.stat-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}
```

Empty state (no memory yet):
```html
<div class="empty-state memory-empty">
  <span class="codicon codicon-database"></span>
  <p>No memory yet</p>
  <button class="link-btn" onclick="explainFile()">
    Run Explain to create it
  </button>
</div>
```

### Action Buttons

Two rows of buttons using VS Code button styling.

```css
.action-row {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  flex-wrap: wrap;
}
/* Primary = vscode-button */
button.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 4px 10px;
  border-radius: 2px;
  font-size: 12px;
  cursor: pointer;
  flex: 1;
  min-width: 80px;
}
button.primary:hover {
  background: var(--vscode-button-hoverBackground);
}
/* Secondary = vscode-button-secondary */
button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  padding: 4px 10px;
  border-radius: 2px;
  font-size: 12px;
  cursor: pointer;
  flex: 1;
  min-width: 80px;
}
/* Review button pulse when pending change exists */
@keyframes pulse-pending {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--vscode-button-background), 0.4); }
  50%       { box-shadow: 0 0 0 4px rgba(var(--vscode-button-background), 0); }
}
button.review-pending {
  animation: pulse-pending 2s infinite;
  background: var(--vscode-inputValidation-warningBackground, #fbbf24);
  color: #1a1a1a;
}
```

Button visibility rules:
| Button | Visible when |
|--------|-------------|
| Ask for Change | Always |
| Review Pending | `WorkflowState.pendingResponse !== undefined` |
| Full Memory | `fileMemory !== null` |
| Clear Memory | `fileMemory !== null` |
| Explain File | Always |

### Event Feed

```css
.event-feed {
  padding: 8px 12px;
}
.event-feed-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vscode-sideBarSectionHeader-foreground);
  display: flex;
  justify-content: space-between;
  cursor: pointer; /* toggle collapse */
}
.event-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
  line-height: 1.4;
}
.event-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 3px;
  flex-shrink: 0;
}
.event-dot.change     { background: #3b82d4; }
.event-dot.validation { background: #22c55e; }
.event-dot.validation.fail { background: #ef4444; }
.event-dot.summary    { background: #a78bfa; }
.event-dot.compression{ background: #f59e0b; }
.event-dot.user       { background: var(--vscode-foreground); }
.event-time {
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 52px;
}
.event-text {
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## Memory Detail Panel — Full Spec

```
┌──────────────────────────────────────────────────────────────┐
│  🧠 Memory Detail                                  [× close] │
├──────────────────────────────────────────────────────────────┤
│  src/commands/askForChange.ts                                │
│  TypeScript · Hash: a3f2c1d8 · 7 events                     │
├──────────────────────────────────────────────────────────────┤
│  SUMMARY                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Handles the Gemini-backed "Ask for Change" command  │   │
│  │  flow: key validation, prompt input, diff preview,   │   │
│  │  approval, and memory recording.                     │   │
│  └──────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  CONSTRAINTS                                                 │
│  · Max 5× size growth allowed                                │
│  · No silent rewrites — always show diff                     │
├──────────────────────────────────────────────────────────────┤
│  DECISIONS                                                   │
│  · Use WorkspaceEdit API for applying changes                │
│  · Append MemoryEvent on every approved change               │
│  · Store pending state in WorkflowState singleton            │
├──────────────────────────────────────────────────────────────┤
│  KNOWN FLAWS                                                 │
│  · No retry logic on Gemini timeout                          │
├──────────────────────────────────────────────────────────────┤
│  EVENT HISTORY                            [↓ Export JSON]   │
│  ─────────────────────────────────────────────────────────  │
│  ● change      2024-01-15 14:32  Added input validation  ▼  │
│    Detail: decisions: Use WorkspaceEdit API                 │
│  ─────────────────────────────────────────────────────────  │
│  ● validation  2024-01-15 14:32  Validation passed on…      │
│  ─────────────────────────────────────────────────────────  │
│  ● summary     2024-01-15 13:11  Initial summary stored     │
└──────────────────────────────────────────────────────────────┘
```

### Layout Grid

```css
.memory-panel {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 20px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}
.panel-subtitle {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 16px;
}
.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vscode-descriptionForeground);
  margin: 14px 0 6px;
}
.summary-block {
  background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1));
  border-left: 3px solid var(--vscode-textBlockQuote-border, #a78bfa);
  padding: 8px 12px;
  border-radius: 0 4px 4px 0;
  font-size: 13px;
  line-height: 1.6;
}
.list-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.5;
}
.list-item::before {
  content: '·';
  color: var(--vscode-textLink-foreground);
  font-weight: bold;
  flex-shrink: 0;
}
```

### Event Row Detail Expansion

Each event row is a `<details>` / `<summary>` element:

```html
<details class="event-row-detail">
  <summary class="event-row-header">
    <span class="event-dot change"></span>
    <span class="event-timestamp">2024-01-15 14:32</span>
    <span class="event-type-badge change">change</span>
    <span class="event-summary-text">Added input validation to processUser</span>
  </summary>
  <div class="event-detail-content">
    <pre>decisions: Use WorkspaceEdit API; append MemoryEvent on approve</pre>
  </div>
</details>
```

```css
.event-row-detail {
  border-bottom: 1px solid var(--vscode-widget-border);
}
.event-row-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
  list-style: none;
  font-size: 12px;
}
.event-row-header::-webkit-details-marker { display: none; }
.event-timestamp {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  white-space: nowrap;
}
.event-type-badge {
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.event-type-badge.change     { background: rgba(59,130,212,0.15); color: #3b82d4; }
.event-type-badge.validation { background: rgba(34,197,94,0.15);  color: #22c55e; }
.event-type-badge.summary    { background: rgba(167,139,250,0.15);color: #a78bfa; }
.event-detail-content {
  padding: 6px 12px 10px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  margin: 0 0 6px;
}
.event-detail-content pre {
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  margin: 0;
  white-space: pre-wrap;
  color: var(--vscode-descriptionForeground);
}
```

---

## Ask for Change Panel — Full Spec

```
┌──────────────────────────────────────────────────────────────┐
│  ✏️ Ask for Change                                          │
│  src/commands/askForChange.ts · TypeScript · 137 lines      │
├──────────────────────────────────────────────────────────────┤
│  Context                                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Memory: Handles Gemini-backed change flow…            │  │
│  │  Related files included: 3                             │  │
│  │  Qwen ● · Gemini ✓                                    │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── Conversation Log (scrollable) ──────────────────────── │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  YOU                                   14:30        │    │
│  │  Add input validation to processUser()              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  GEMINI                  Confidence ████████░ 0.92  │    │
│  │  Summary: Added null check and type guard to the    │    │
│  │  processUser function signature.                    │    │
│  │  ─────────────────────────────────────────────────  │    │
│  │  Warnings: none                                     │    │
│  │  Tests to run: processUser.test.ts                  │    │
│  │  ─────────────────────────────────────────────────  │    │
│  │  [✅ Approve]  [❌ Reject]                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ✅ APPROVED                                        │    │
│  │  Validation: ✓ type-check  ✓ lint                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────── [$(send) Send ▶]──── ┐  │
│  │  What change should Tursiops make?                   │  │
│  └────────────────────────────────────────────────────── ┘  │
└──────────────────────────────────────────────────────────────┘
```

### Conversation Bubbles

**User bubble:**
```css
.bubble-user {
  background: var(--vscode-inputValidation-infoBackground, rgba(59,130,212,0.1));
  border: 1px solid var(--vscode-inputValidation-infoBorder, rgba(59,130,212,0.3));
  border-radius: 6px 6px 6px 0;
  padding: 10px 14px;
  margin-bottom: 12px;
  max-width: 480px;
}
.bubble-user .bubble-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #3b82d4;
  margin-bottom: 4px;
}
```

**Gemini bubble:**
```css
.bubble-gemini {
  background: var(--vscode-editor-inactiveSelectionBackground);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 6px 6px 0 6px;
  padding: 10px 14px;
  margin-bottom: 12px;
  max-width: 520px;
  align-self: flex-end;
}
.bubble-gemini .bubble-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

**Confidence bar:**
```css
.confidence-bar-track {
  width: 80px;
  height: 4px;
  background: var(--vscode-scrollbarSlider-background);
  border-radius: 2px;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
}
.confidence-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e);
  /* width set by JS: `${response.confidence * 100}%` */
}
```

**Approve / Reject buttons:**
```css
.decision-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.btn-approve {
  background: rgba(34,197,94,0.15);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,0.3);
  padding: 4px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn-approve:hover { background: rgba(34,197,94,0.25); }
.btn-reject {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.25);
  padding: 4px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn-reject:hover { background: rgba(239,68,68,0.2); }
```

**Thinking / Spinner state:**
```html
<div class="bubble-status thinking">
  <span class="codicon codicon-loading codicon-modifier-spin"></span>
  Waiting for Gemini…  Attempt 1/3
</div>
```

**Validation result badge:**
```html
<!-- pass -->
<div class="validation-badge pass">
  <span class="codicon codicon-pass"></span>
  type-check ✓ &nbsp; lint ✓
</div>

<!-- fail -->
<div class="validation-badge fail">
  <span class="codicon codicon-error"></span>
  type-check ✗ &nbsp; <a href="#" onclick="showErrors()">view errors</a>
</div>
```

```css
.validation-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  margin-top: 6px;
}
.validation-badge.pass {
  background: rgba(34,197,94,0.1);
  color: #22c55e;
}
.validation-badge.fail {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}
```

**Correction attempt indicator:**
```html
<div class="correction-notice">
  ↩ Correction attempt 2/3 — fixing type errors
</div>
```

```css
.correction-notice {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
  padding: 4px 0;
  text-align: center;
}
```

### Input Row

```css
.input-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--vscode-widget-border);
  background: var(--vscode-sideBar-background);
  position: sticky;
  bottom: 0;
}
.prompt-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  font-family: var(--vscode-font-family);
  font-size: 12px;
  resize: none;
  min-height: 32px;
  max-height: 80px;
  overflow-y: auto;
}
.prompt-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
}
.send-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Status Bar Item — Full Spec

### Layout

```
🐬 Tursiops  ·  7 events  ·  Qwen ●  Gemini ✓
```

States and colours:

| State | Text | Colour class |
|-------|------|-------------|
| Idle, no file | `🐬 Tursiops` | Default |
| File tracked, idle | `🐬 7 events` | Default |
| AI thinking | `🐬 $(loading~spin) Thinking…` | `statusBarItem.warningBackground` |
| Pending change | `🐬 ● Review pending` | `statusBarItem.warningBackground` |
| Error | `🐬 ⚠ Error` | `statusBarItem.errorBackground` |
| Validation pass | `🐬 ✓ Validated` | Default (2s then revert) |
| Validation fail | `🐬 ✗ Needs fix` | `statusBarItem.errorBackground` (5s) |

```typescript
// StatusBarManager.ts sketch
class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 100
    );
    this.item.command = 'tursiops.openSidebar';
    this.item.show();
  }

  setIdle(eventCount?: number): void
  setThinking(attempt?: number): void
  setPending(): void
  setError(msg: string): void
  setValidated(passed: boolean): void
  updateProviders(qwen: boolean, gemini: boolean): void  // tooltip
}
```

---

## Editor Decorations — Full Spec

### Gutter Icon

A small dolphin / brain glyph in the editor gutter on **line 1** of any file that has a `FileMemory` record.

```typescript
const memoryDecorationType = vscode.window.createTextEditorDecorationType({
  gutterIconPath: context.asAbsolutePath('icons/tursiops-gutter.svg'),
  gutterIconSize: 'contain',
});
```

Gutter icon file: `icons/tursiops-gutter.svg` — a 16×16 minimal circle with a dot, using `currentColor` fill so it adapts to the theme.

### Hover Tooltip

Achieved by setting `hoverMessage` on the decoration range:

```typescript
const decoration: vscode.DecorationOptions = {
  range: new vscode.Range(0, 0, 0, 0),
  hoverMessage: new vscode.MarkdownString(
    `**Tursiops Memory**\n\n${memory.summary.slice(0, 120)}…\n\n` +
    `*Last change: ${relativeTime(lastEvent.timestamp)}*`
  ),
};
```

### Refresh Triggers

```typescript
// DecorationManager.ts
vscode.window.onDidChangeActiveTextEditor(() => refresh());
memoryStore.onChange(() => refresh());
```

---

## Content Security Policy

Every webview HTML file includes:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           style-src ${webview.cspSource} 'unsafe-inline';
           script-src 'nonce-${nonce}';
           font-src ${webview.cspSource};
           img-src ${webview.cspSource} data:;">
```

- `'unsafe-inline'` is required for styles only — inline CSS in webviews is standard VS Code practice
- Scripts always require `nonce-${nonce}` where `nonce` is a freshly generated UUID per panel open
- No external URLs allowed
- No `eval` or `new Function`

---

## Icon Files Required

| File | Size | Description |
|------|------|-------------|
| `icons/tursiops.svg` | 24×24 | Activity bar icon (monochrome, filled) |
| `icons/tursiops-dark.svg` | 24×24 | Light-theme variant (dark lines) |
| `icons/tursiops-gutter.svg` | 16×16 | Gutter decoration icon |

All icons use `currentColor` where possible so VS Code can apply theme colours.

Activity bar icon SVG skeleton (dolphin silhouette or abstract T mark):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <!-- Stylised T or dolphin arc — monochrome path only -->
  <path fill="currentColor" d="M4 6h16v2H4z M11 8h2v10h-2z"/>
</svg>
```

---

## Webview Asset Paths

```typescript
// Inside any WebviewViewProvider or WebviewPanel
const scriptUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'sidebar.js')
);
const styleUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'sidebar.css')
);
const codiconsUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
);
```

---

## Empty States

| Panel | Condition | Message |
|-------|-----------|---------|
| Sidebar — Active File | No editor open | "Open a file to get started" |
| Sidebar — Memory | File has no memory | "Run Explain to create memory" |
| Memory Panel | `MemoryStore.get(fileId)` returns undefined | "No memory recorded for this file" |
| Ask Panel — log | No conversation yet | "Ask Tursiops to make a change below" |
| Sidebar — Events | 0 events | "No events recorded yet" |

---

## Accessibility

- All interactive elements have accessible labels (`aria-label`, `title`, or visible text)
- Keyboard-navigable: Tab order follows reading order
- Focus ring uses `outline: 1px solid var(--vscode-focusBorder)` — not removed
- Spinner animation respects `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .codicon-modifier-spin { animation: none; }
  }
  ```
- Colour is never the only signal — type badges, icons, and text labels accompany all colour dots

---

## Responsive Width Handling

The sidebar can be very narrow (180px minimum VS Code allows). Components adapt:

```css
/* At narrow widths, stack action buttons vertically */
@media (max-width: 240px) {
  .action-row { flex-direction: column; }
  .stat-chips  { flex-direction: column; }
}
/* File name truncation */
.file-name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## Summary of All New Files

### TypeScript (extension host)
| File | Purpose |
|------|---------|
| `src/ui/SidebarProvider.ts` | `WebviewViewProvider` for Activity Bar sidebar |
| `src/ui/MemoryPanelProvider.ts` | `WebviewPanel` factory for Memory Detail |
| `src/ui/AskPanelProvider.ts` | `WebviewPanel` factory + orchestrator bridge for Ask |
| `src/ui/StatusBarManager.ts` | Status bar item lifecycle |
| `src/ui/DecorationManager.ts` | Gutter decoration management |
| `src/ui/MessageBus.ts` | Typed `postMessage` send/receive helpers |

### Webview Client (TypeScript → compiled JS)
| File | Purpose |
|------|---------|
| `src/ui/webviews/sidebar/sidebar.ts` | Sidebar panel client logic |
| `src/ui/webviews/memory/memory.ts` | Memory panel client logic |
| `src/ui/webviews/ask/ask.ts` | Ask panel client logic + state machine |

### HTML Shells (static, referenced by providers)
| File | Purpose |
|------|---------|
| `src/ui/webviews/sidebar/index.html` | Sidebar HTML skeleton |
| `src/ui/webviews/memory/index.html` | Memory panel HTML skeleton |
| `src/ui/webviews/ask/index.html` | Ask panel HTML skeleton |

### CSS (co-located with HTML)
| File | Purpose |
|------|---------|
| `src/ui/webviews/sidebar/sidebar.css` | Sidebar styles |
| `src/ui/webviews/memory/memory.css` | Memory panel styles |
| `src/ui/webviews/ask/ask.css` | Ask panel styles |

### Icons
| File | Purpose |
|------|---------|
| `icons/tursiops.svg` | Activity bar icon |
| `icons/tursiops-dark.svg` | Light-theme variant |
| `icons/tursiops-gutter.svg` | Editor gutter icon |

### Modified Files
| File | Change |
|------|--------|
| `src/extension.ts` | Register all UI providers |
| `src/memory/MemoryStore.ts` | Add `onChange` EventEmitter |
| `src/utils/logging.ts` | Add `onLog` EventEmitter for status bar |
| `package.json` | Add viewsContainers, views, menus, icon |
| `esbuild.js` | Add webview entry points |
