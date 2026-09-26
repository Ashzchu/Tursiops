# Tursiops — UI Implementation Plan

## Context

All backend phases (1–8) are complete. The extension currently operates entirely through:
- The **VS Code Command Palette** (6 commands)
- The **Output Channel** (text-only logs)
- Native VS Code modals (`showInputBox`, `showInformationMessage`, `showDiff`)

The task now is to give Tursiops a **dedicated UI layer** inside VS Code: a sidebar panel (Activity Bar view), a status bar indicator, and rich Webview panels — all backed by the existing TypeScript modules with zero changes to the core logic.

---

## What Exists (Backend Contracts to Honour)

| Module | What the UI can call |
|--------|----------------------|
| `MemoryStore` | `load()`, `get(fileId)`, `getOrCreate(...)`, `update(...)`, `appendEvent(...)`, `save()` |
| `AgentOrchestrator.runWithValidation(options)` | Full AI-change loop with diff + approval |
| `GeminiProvider.requestChange(prompt, packet)` | Cloud reasoning call |
| `QwenProvider.summarize / isAvailable()` | Local summarisation + health check |
| `ApiKeyManager.getGeminiKey / setGeminiKey / clearGeminiKey` | Secure key management |
| `WorkflowState` | Pending change state |
| `MemorySchema` — `FileMemory`, `MemoryEvent` | Read-only data structures for display |
| `ValidationResult` | Pass/fail + output string |

The UI calls these — it never re-implements them.

---

## UI Surface Map

```
┌─────────────────────────────────────────────────────────────────┐
│  VS Code Activity Bar                                           │
│  ┌─────────┐                                                    │
│  │  🐬  T  │  ← Tursiops sidebar icon (custom SVG)             │
│  └─────────┘                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Sidebar Panel (TreeView / WebviewView)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TURSIOPS                                               │   │
│  │  ──────────────────────────────────────────────────    │   │
│  │  Active File: src/commands/askForChange.ts              │   │
│  │                                                         │   │
│  │  [Memory]  [Ask AI]  [History]                         │   │
│  │                                                         │   │
│  │  ╔══════════ FILE MEMORY ═══════════╗                  │   │
│  │  ║  Summary: handles Gemini-based…  ║                  │   │
│  │  ║  Constraints (2)  Decisions (3)  ║                  │   │
│  │  ║  Known Flaws (1)  Events (7)     ║                  │   │
│  │  ╚══════════════════════════════════╝                  │   │
│  │                                                         │   │
│  │  [Ask for Change]  [Review Pending]  [Clear Memory]    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Status Bar (bottom)                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🐬 Tursiops · 3 events · Qwen ● · Gemini ✓             │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Webview Panels (tab-like, open on demand)                      │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │  Memory Detail Panel │  │  Ask for Change Panel          │  │
│  │  (full file memory)  │  │  (chat-like input + log)       │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components — Detailed Breakdown

### 1. Activity Bar + Sidebar (`WebviewViewProvider`)

**View ID:** `tursiops.sidebarView`  
**Registration:** `contributes.viewsContainers.activitybar` + `contributes.views.tursiops`

The sidebar is a single `WebviewViewProvider` that renders a self-contained HTML panel. It updates whenever:
- The active editor changes (`vscode.window.onDidChangeActiveTextEditor`)
- Memory is written (`MemoryStore.save()` → fires a custom event)
- A pending change appears in `WorkflowState`

#### Sections

**Header bar**
- Tursiops logo + wordmark
- Provider status dots: `Qwen ●` (green/grey) · `Gemini ✓` (green/red/unconfigured)
- Settings gear icon → opens `Tursiops.setGeminiKey`

**Active File Card**
- File icon (derived from language ID) + relative path
- Language badge (e.g. `TypeScript`)
- Line count
- "No file open" empty state when no editor is active

**Memory Summary Card**
- AI-generated summary paragraph (truncated to 3 lines, expandable)
- Four stat chips: `Constraints N` · `Decisions N` · `Flaws N` · `Events N`
- "No memory yet" empty state with prompt to run Explain

**Action Buttons (primary row)**
- `Ask for Change` → opens the Ask panel (Section 3)
- `Review Pending` → visible only when `WorkflowState.pendingResponse` is set; pulses
- `Explain File` → runs `Tursiops.explainFile`

**Action Buttons (secondary row)**
- `Show Full Memory` → opens Memory Detail panel (Section 2)
- `Clear Memory` → confirm dialog → `Tursiops.clearFileMemory`

**Event Feed (bottom, collapsible)**
- Last 5 `MemoryEvent` items as a minimal timeline
- Each row: coloured dot (type) · timestamp (relative) · summary text
- "View all" link → opens Memory Detail panel

---

### 2. Memory Detail Webview Panel

**Command:** `Tursiops.openMemoryPanel`  
**Type:** `vscode.WebviewPanel` (column: `vscode.ViewColumn.Beside`)

Opens as a tab next to the active editor. Reads `MemoryStore.get(fileId)` and renders the full `FileMemory` record.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  🧠 Memory — src/commands/askForChange.ts               │
│  Language: TypeScript · Hash: a3f2c1…                   │
├──────────────────────────────────────────────────────────┤
│  SUMMARY                                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Handles the Gemini-backed "Ask for Change"        │  │
│  │  command flow: key validation, prompt input,       │  │
│  │  diff preview, approval, and memory recording.     │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  CONSTRAINTS            │  DECISIONS                     │
│  · Max 5× size growth   │  · Use WorkspaceEdit API       │
│  · No silent rewrites   │  · Append events on approve    │
├──────────────────────────────────────────────────────────┤
│  KNOWN FLAWS                                             │
│  · No retry on Gemini timeout                            │
├──────────────────────────────────────────────────────────┤
│  EVENT HISTORY  (7 events)                    [Export]   │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ● change     2 min ago  Added input validation  │    │
│  │  ● validation 2 min ago  Validation passed       │    │
│  │  ● summary    1 hr ago   Initial summary stored  │    │
│  │  …                                               │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

#### Interactions
- Clicking any list item expands `detail` field inline
- `[Export]` button copies the full `FileMemory` JSON to clipboard
- Auto-refreshes when the extension posts a `memoryUpdated` message to the webview

---

### 3. Ask for Change Panel (Chat-like Webview)

**Command:** `Tursiops.openAskPanel`  
**Type:** `vscode.WebviewPanel` (column: `vscode.ViewColumn.Active`)

Replaces the current `showInputBox` + output channel interaction with an inline panel.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  ✏️ Ask for Change — askForChange.ts                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Previous exchange log — scrollable]                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  You: Add input validation to processUser()        │  │
│  │  ─────────────────────────────────────────────    │  │
│  │  Gemini (confidence 0.92):                        │  │
│  │    Summary: Added null + type checks to the        │  │
│  │    function signature and threw on invalid…        │  │
│  │    Warnings: None                                  │  │
│  │    Tests to run: processUser.test.ts               │  │
│  │                                                    │  │
│  │  [✅ Approved — change applied]                    │  │
│  │  [🔍 Validation: ✓ type-check ✓ lint]             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Context: askForChange.ts · TypeScript · 137 lines       │
│  Provider: ● Gemini (flash)   Related files: 3 included  │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────── [Send] ┐  │
│  │  What change should Tursiops make?                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### Interactions
- Sending a message triggers `AgentOrchestrator.runWithValidation()`
- Progress spinner replaces Send button while waiting
- Gemini response renders with: summary · warnings · testsToRun · confidence bar
- Approve/Reject buttons embedded in the response bubble
- Retry counter: `Attempt 2/3` shown on corrections
- Validation result badge: green check or red X per runner
- Session history persists for the lifetime of the panel (cleared on close)

---

### 4. Status Bar Item

**ID:** `tursiops.statusBar`  
**Alignment:** Right, priority 100

Format: `🐬 Tursiops · {N} events · {providers}`

| State | Display |
|-------|---------|
| Idle, no file | `🐬 Tursiops` |
| File with memory | `🐬 3 events` |
| AI running | `🐬 $(loading~spin) Thinking…` |
| Pending change | `🐬 ● Review pending` (amber) |
| Error | `🐬 ⚠ Error` (red) |

Click → opens sidebar panel.

Provider indicators shown as tooltip:
```
Qwen: ● available (qwen2.5-coder:7b)
Gemini: ✓ key configured
```

---

### 5. Editor Decorations (lightweight, Phase 2 UI)

**Purpose:** Non-intrusive awareness layer in the editor gutter.

- Gutter icon on line 1 of any file that has a memory record
- Hover tooltip shows `Summary: <first sentence>` + `Last change: <relative time>`
- No line-level decorations (too noisy for v1)

---

## Message Protocol (Extension ↔ Webview)

All webviews communicate with the extension host over `vscode.postMessage`. Typed message shapes:

### Extension → Webview

```typescript
// Sidebar / Memory panel refresh
{ type: 'memoryUpdated'; payload: FileMemory | null }

// Ask panel: response from Gemini
{ type: 'geminiResponse'; payload: { response: AgentResponse; attempt: number } }

// Ask panel: validation result
{ type: 'validationResult'; payload: { typeCheck: ValidationResult; lint: ValidationResult } }

// Ask panel: change approved/rejected
{ type: 'changeDecision'; payload: { decision: 'approved' | 'rejected'; summary: string } }

// Status update (spinner, error, idle)
{ type: 'statusUpdate'; payload: { status: 'idle' | 'thinking' | 'pending' | 'error'; message?: string } }

// Active file changed
{ type: 'activeFileChanged'; payload: { relativePath: string; language: string; lineCount: number } | null }
```

### Webview → Extension

```typescript
// User submits a prompt
{ type: 'askForChange'; payload: { prompt: string } }

// User approves a change
{ type: 'approveChange' }

// User rejects a change
{ type: 'rejectChange' }

// User wants to clear memory for current file
{ type: 'clearMemory' }

// User wants to set Gemini key
{ type: 'setGeminiKey' }

// User requests full memory export (JSON to clipboard)
{ type: 'exportMemory' }
```

---

## New Files to Create

```
src/
  ui/
    SidebarProvider.ts        ← WebviewViewProvider for the sidebar
    MemoryPanelProvider.ts    ← WebviewPanel for Memory Detail
    AskPanelProvider.ts       ← WebviewPanel for Ask for Change
    StatusBarManager.ts       ← Status bar item management
    DecorationManager.ts      ← Editor gutter decorations
    MessageBus.ts             ← Typed postMessage helpers (ext ↔ webview)
    webviews/
      sidebar/
        index.html            ← Sidebar HTML shell
        sidebar.css           ← Sidebar styles
        sidebar.js            ← Sidebar client-side script
      memory/
        index.html            ← Memory Detail HTML
        memory.css
        memory.js
      ask/
        index.html            ← Ask for Change HTML
        ask.css
        ask.js
  icons/
    tursiops.svg              ← Activity bar icon (monochrome SVG)
    tursiops-dark.svg         ← Dark theme variant
```

### Modified Files

| File | Change |
|------|--------|
| `src/extension.ts` | Register sidebar, status bar, panels, decorations |
| `package.json` | Add `viewsContainers`, `views`, `menus`, icon paths |
| `src/utils/logging.ts` | Add `onLog` event emitter for status bar live updates |
| `src/memory/MemoryStore.ts` | Add `onChange` event emitter for panel auto-refresh |
| `esbuild.js` | Bundle webview assets (HTML/CSS/JS) into `dist/` |

---

## package.json Additions

```jsonc
"contributes": {
  "viewsContainers": {
    "activitybar": [{
      "id": "tursiops",
      "title": "Tursiops",
      "icon": "icons/tursiops.svg"
    }]
  },
  "views": {
    "tursiops": [{
      "type": "webview",
      "id": "tursiops.sidebarView",
      "name": "Tursiops"
    }]
  },
  "menus": {
    "view/title": [{
      "command": "Tursiops.openMemoryPanel",
      "when": "view == tursiops.sidebarView",
      "group": "navigation"
    }]
  }
}
```

---

## Design Tokens & Visual Language

### Colour Palette (VSCode-native CSS variables)

| Token | Value | Usage |
|-------|-------|-------|
| `--vscode-editor-background` | dynamic | Panel backgrounds |
| `--vscode-sideBar-background` | dynamic | Sidebar bg |
| `--vscode-foreground` | dynamic | Body text |
| `--vscode-descriptionForeground` | dynamic | Muted text |
| `--vscode-textLink-foreground` | dynamic | Links, accents |
| `--vscode-button-background` | dynamic | Primary buttons |
| `--vscode-button-foreground` | dynamic | Button labels |
| `--vscode-badge-background` | dynamic | Stat chips |
| `--vscode-inputValidation-errorBackground` | dynamic | Error states |
| `--color-event-change` | `#3b82d4` | Change event dot |
| `--color-event-validation` | `#22c55e` | Validation pass dot |
| `--color-event-summary` | `#a78bfa` | Summary event dot |
| `--color-event-error` | `#ef4444` | Error / fail dot |

No hardcoded hex colours in component CSS — only CSS variables so both light and dark themes work automatically.

### Typography
- Use `--vscode-font-family` and `--vscode-font-size` throughout
- Code/hash snippets: `font-family: var(--vscode-editor-font-family)`
- No custom fonts loaded

### Spacing
- Base unit: `4px`
- Section padding: `12px`
- Card padding: `8px 12px`
- Action button gap: `6px`

### Icons
- Use VS Code Codicons (`$(icon-name)` in labels where supported, `codicon` CSS class in webviews)
- No external icon libraries

---

## State Machine for Ask Panel

```
IDLE
  │  user submits prompt
  ▼
THINKING  (spinner, Send disabled)
  │  geminiResponse received
  ▼
AWAITING_DECISION  (Approve / Reject buttons shown)
  ├── reject → IDLE (log entry: rejected)
  └── approve → APPLYING
        │  changeDecision{approved}
        ▼
      VALIDATING  (validation badge animates)
        ├── pass → IDLE (log entry: ✓ applied)
        └── fail + attempts < 3 → THINKING (correction)
              fail + attempts == 3 → IDLE (log entry: ⚠ limit reached)
```

---

## Security Constraints (carry forward from backend)

- All webview HTML uses `Content-Security-Policy` nonce — no inline scripts, no `unsafe-inline`
- Webview `localResourceRoots` restricted to `dist/webviews/`
- No API key is ever sent from extension to webview; webview only sends `{ type: 'setGeminiKey' }` and the extension host handles the `showInputBox` + `SecretStorage` flow
- Webview JS bundles are compiled and hashed at build time (esbuild output)
- All text inserted into the webview DOM uses `textContent` or `createElement` — never `innerHTML` with user data

---

## Build Integration

The webview JS/CSS files are compiled by esbuild as separate entry points and placed in `dist/webviews/`. The extension reads them from disk using `webview.asWebviewUri(...)`.

```
esbuild.js additions:
  entryPoints: [
    'src/ui/webviews/sidebar/sidebar.ts',
    'src/ui/webviews/memory/memory.ts',
    'src/ui/webviews/ask/ask.ts',
  ],
  outdir: 'dist/webviews/',
  bundle: true,
  format: 'iife',
```

HTML shells reference the compiled output:
```html
<script nonce="${nonce}" src="${scriptUri}"></script>
```

---

## Phased Build Order

### Phase UI-1 — Foundation (no visible UI yet)
1. Create `src/ui/MessageBus.ts` (typed message helpers)
2. Create `src/ui/StatusBarManager.ts` + register in `extension.ts`
3. Add `onChange` emitter to `MemoryStore`
4. Add activity bar icon + `viewsContainers` / `views` to `package.json`

### Phase UI-2 — Sidebar Panel
5. Create `SidebarProvider.ts`
6. Create `src/ui/webviews/sidebar/` (HTML + CSS + JS)
7. Wire active editor watcher → sidebar refresh
8. Wire memory `onChange` → sidebar refresh

### Phase UI-3 — Memory Detail Panel
9. Create `MemoryPanelProvider.ts`
10. Create `src/ui/webviews/memory/` (HTML + CSS + JS)
11. Register `Tursiops.openMemoryPanel` command

### Phase UI-4 — Ask for Change Panel
12. Create `AskPanelProvider.ts`
13. Create `src/ui/webviews/ask/` (HTML + CSS + JS)
14. Route `askForChange` webview message → `AgentOrchestrator.runWithValidation()`
15. Stream status updates back to webview during orchestrator run

### Phase UI-5 — Editor Decorations
16. Create `DecorationManager.ts`
17. Register gutter icon decoration on files with memory records
18. Refresh on editor switch + memory update

### Phase UI-6 — Polish
19. Keyboard shortcuts (`⇧⌘T` → Ask panel)
20. Context menu entries on editor (right-click → "Tursiops: Ask for Change")
21. Onboarding empty state (first-run welcome in sidebar)
22. Error boundary: unhandled rejection → status bar ⚠ + log

---

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | Sidebar appears in Activity Bar after install; shows active file name and memory summary |
| 2 | Memory Detail panel opens with full FileMemory record and auto-refreshes on save |
| 3 | Ask panel accepts a prompt, shows spinner, renders Gemini response with Approve/Reject |
| 4 | Approving in the Ask panel applies the change identically to the command-palette flow |
| 5 | Validation result (pass/fail) appears in the Ask panel after approval |
| 6 | Status bar shows event count for active file and updates live |
| 7 | No API key is ever rendered in any webview HTML |
| 8 | All panels respect VS Code's light/dark/high-contrast themes via CSS variables |
| 9 | `npm run check-types` and `npm run lint` pass with zero new errors after UI is added |
| 10 | Panel closes cleanly — no memory leaks, no dangling event listeners |
