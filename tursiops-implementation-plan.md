# Tursiops — 8-Agent Implementation Plan

## Starting State

- VS Code extension scaffold is complete: `package.json`, `src/extension.ts` (Hello World stub), build tooling (`esbuild.js`, `tsconfig.json`), dev dependencies installed
- **Runtime dependencies NOT yet installed** — `zod`, `diff` still need to be added
- **No implementation files exist** — `src/` contains only `extension.ts` and `test/extension.test.ts`
- All 7 phases need to be built: Active File Reader → Memory → Qwen → Gemini → Diff/Approval → Validation Loop → Related-File Context + Secret Filter

---

## Master Safety Rule

> The AI proposes JSON → Zod validates it → VS Code shows a diff → user approves explicitly → WorkspaceEdit applies the change.
>
> **This rule must not be broken by any agent.**

---

## 8-Agent Build Strategy

Seven specialist agents build one phase each in parallel (Agents 1–7). Each agent owns its files completely and exports clean, typed interfaces at its boundary. Agent 8 is the integration agent — it runs after the seven specialists are done, wires all boundaries together in `extension.ts`, fixes cross-agent type mismatches, runs `check-types` + `lint`, and verifies the full end-to-end flow.

### Why this works

Each phase maps to a clean module boundary with minimal cross-dependencies at build time. Agents 1–3 are fully independent. Agents 4–7 each depend on the outputs of earlier agents, but those outputs are **interface contracts** the plan defines upfront — the later agents code to the contract, and Agent 8 resolves any real mismatches.

---

## Shared Interface Contracts

These types must be consistent across all agents. Every agent codes to these contracts. Agent 8 enforces them.

```typescript
// WorkspaceMemory — owned by Agent 2 (MemoryStore)
interface WorkspaceMemory {
  version: 1;
  workspaceId: string;
  files: Record<string, FileMemory>;
}

interface FileMemory {
  fileId: string;
  filePath: string;
  language: string;
  currentHash: string;
  summary: string;
  constraints: string[];
  decisions: string[];
  knownFlaws: string[];
  events: MemoryEvent[];
}

interface MemoryEvent {
  timestamp: string;        // ISO string
  type: 'summary' | 'change' | 'validation' | 'user' | 'compression';
  summary: string;
  detail?: string;
}

// ActiveFile — owned by Agent 1 (ActiveFileReader)
interface ActiveFile {
  uri: vscode.Uri;
  relativePath: string;
  languageId: string;
  content: string;
  lineCount: number;
}

// AgentResponse — owned by Agent 4 (Gemini + Zod)
interface AgentResponse {
  updatedFile: string;
  summary: string;
  decisions: string[];
  warnings: string[];
  testsToRun: string[];
  confidence: number;
}

// ValidationResult — owned by Agent 6 (Validation Loop)
interface ValidationResult {
  passed: boolean;
  command: string;
  exitCode: number;
  output: string;
}

// ContextPacket — owned by Agent 7 (Related Files)
interface ContextPacket {
  requestId: string;
  fileId: string;
  filePath: string;
  language: string;
  userPrompt: string;
  currentFile: { content: string; hash: string };
  memory: {
    summary: string;
    constraints: string[];
    decisions: string[];
    knownFlaws: string[];
    recentEvents: MemoryEvent[];
  };
  relatedFiles: Array<{ path: string; content: string }>;
  tokenBudget: number;
}
```

---

## Agent 1 — Active File Reader + explainFile Command

**Model:** `claude-sonnet-4-5` (precise VS Code API usage, needs accuracy over speed)
**Phase:** Phase 1
**Status:** `[ ] pending`

### Files to create/modify
- `src/context/ActiveFileReader.ts` ← **create**
- `src/commands/explainFile.ts` ← **create**
- `src/utils/logging.ts` ← **create**
- `src/extension.ts` ← **modify** (add explainFile registration only)
- `package.json` ← **modify** (add command + change activationEvents)

### Intent
Give Tursiops the ability to identify and read the currently active file. This is the foundation — every other phase scopes its work to what this agent produces.

### Contract: what Agent 1 exports
```typescript
// src/context/ActiveFileReader.ts
export function readActiveFile(editor: vscode.TextEditor): ActiveFile
export function getActiveEditor(): vscode.TextEditor | undefined
```

### Expected Outcomes
- "Tursiops: Explain Current File" appears in Command Palette
- Running it on an open `.ts` file shows the file name, relative path, language, and line count
- Reading uses the editor buffer (`editor.document.getText()`), not `fs.readFile` — captures unsaved changes
- If no file is open: friendly warning message, no crash
- `activationEvents` changed to `["onStartupFinished"]`

### Todo List
1. Create `src/utils/logging.ts`:
   - Create a VS Code output channel named "Tursiops" (singleton)
   - Export `log(msg: string): void` and `logError(msg: string, err?: unknown): void`
   - Never log API keys, full file content, or raw model responses
2. Create `src/context/ActiveFileReader.ts`:
   - Export `readActiveFile(editor)` returning `ActiveFile` (interface defined above)
   - Use `vscode.workspace.asRelativePath(uri)` for relative path
   - Use `editor.document.getText()` for content
3. Create `src/commands/explainFile.ts`:
   - Export `registerExplainFile(context: vscode.ExtensionContext): void`
   - Registers command `Tursiops.explainFile`
   - Calls `readActiveFile`, shows file info in the Tursiops output channel
   - If no active editor: `vscode.window.showWarningMessage('No active file open.')`
4. In `src/extension.ts`: import `registerExplainFile`, call it inside `activate`
5. In `package.json`:
   - Set `activationEvents` to `["onStartupFinished"]`
   - Add `{ "command": "Tursiops.explainFile", "title": "Tursiops: Explain Current File" }` to `contributes.commands`

### Checkpoint
Open any `.ts` file → run "Tursiops: Explain Current File" → see file info in output panel. No crash when no file is open.

---

## Agent 2 — File Identity, Hashing, and Memory Store

**Model:** `claude-sonnet-4-5` (correctness-critical: atomic writes, stable IDs, data integrity)
**Phase:** Phase 2
**Status:** `[ ] pending`

### Files to create/modify
- `src/utils/hashing.ts` ← **create**
- `src/utils/paths.ts` ← **create**
- `src/memory/MemorySchema.ts` ← **create**
- `src/memory/FileIdentity.ts` ← **create**
- `src/memory/MemoryStore.ts` ← **create**
- `src/memory/MemoryUpdater.ts` ← **create**
- `src/memory/MemoryCompressor.ts` ← **create** (stub — Phase 3 fills it)
- `src/commands/showMemory.ts` ← **create**
- `src/commands/clearFileMemory.ts` ← **create**
- `.gitignore` ← **modify**

### Intent
Give every source file its own persistent memory record that survives restarts. This is the core Tursiops value — file-specific context that accumulates over time.

### Contract: what Agent 2 exports
```typescript
// src/memory/MemoryStore.ts
export class MemoryStore {
  constructor(workspaceRoot: string)
  load(): Promise<void>
  get(fileId: string): FileMemory | undefined
  getOrCreate(fileId: string, filePath: string, language: string): FileMemory
  update(fileId: string, delta: Partial<FileMemory>): void
  appendEvent(fileId: string, event: MemoryEvent): void
  save(): Promise<void>
}

// src/memory/FileIdentity.ts
export function getFileId(workspaceRelativePath: string): string

// src/utils/hashing.ts
export function hashContent(content: string): string
```

### Expected Outcomes
- Opening file A and running "Show Memory" creates `.agent_memory.json` at workspace root with a record for file A
- Opening file B creates a second record; file A record is unchanged
- After VS Code restart, both records persist and load correctly
- Writes use atomic pattern: write to `.agent_memory.json.tmp` first, then `fs.rename` to replace the real file
- `.agent_memory.json` is in `.gitignore`

### Todo List
1. Create `src/utils/hashing.ts`:
   - `hashContent(content: string): string` — SHA256 hex via `crypto.createHash('sha256')`
2. Create `src/utils/paths.ts`:
   - `getWorkspaceRoot(): string | undefined` — first `vscode.workspace.workspaceFolders[0].uri.fsPath`
   - `getMemoryFilePath(root: string): string` — `path.join(root, '.agent_memory.json')`
3. Create `src/memory/MemorySchema.ts`:
   - Export all shared interfaces: `WorkspaceMemory`, `FileMemory`, `MemoryEvent` (per the contracts above)
   - Export `MEMORY_VERSION = 1` constant
4. Create `src/memory/FileIdentity.ts`:
   - `getFileId(relativePath: string): string` — SHA256 of the relative path string (stable, deterministic)
5. Create `src/memory/MemoryStore.ts`:
   - Class `MemoryStore` with the contract above
   - `load()`: read JSON from disk; if missing, initialise `{ version: 1, workspaceId: uuid-like, files: {} }`
   - `save()`: write to `.tmp` then `fs.rename` (atomic)
   - `getOrCreate()`: if file record missing, create it with empty arrays and current hash
   - Use `fs/promises` for I/O (not the VS Code filesystem API — simpler for local files)
6. Create `src/memory/MemoryUpdater.ts`:
   - Export `updateFileMemory(store: MemoryStore, fileId: string, newContent: string, language: string): Promise<void>`
   - Checks if hash changed; if yes, appends a `MemoryEvent` of type `'summary'`
7. Create `src/memory/MemoryCompressor.ts`:
   - Export stub: `compressMemory(memory: FileMemory): Promise<FileMemory>` — returns input unchanged for now (Agent 3 fills this)
8. Create `src/commands/showMemory.ts`:
   - Register `Tursiops.showMemory`
   - Get active file → get its memory → display in the Tursiops output channel
9. Create `src/commands/clearFileMemory.ts`:
   - Register `Tursiops.clearFileMemory`
   - Removes the active file's record from memory, saves, shows confirmation message
10. Add `.agent_memory.json` and `.agent_memory.json.tmp` to `.gitignore`

### Checkpoint
Open file A → "Show Memory" → `.agent_memory.json` created. Open file B → "Show Memory" → second record appears. Restart VS Code → both records survive.

---

## Agent 3 — Qwen Provider via Ollama

**Model:** `claude-sonnet-4-5` (HTTP client, error handling, local AI integration)
**Phase:** Phase 3
**Status:** `[ ] pending`

### Files to create/modify
- `src/ai/AiProvider.ts` ← **create**
- `src/ai/QwenProvider.ts` ← **create**
- `src/memory/MemoryCompressor.ts` ← **fill in** (Agent 2 left a stub)

### Intent
Add a local AI provider for cheap, frequent operations — summarisation, compression, filtering — without cloud API calls. Uses Ollama's local HTTP server. The extension should be mostly usable even when offline.

### Contract: what Agent 3 exports
```typescript
// src/ai/AiProvider.ts
export interface AiProvider {
  summarize(content: string, language: string): Promise<string>
  compress(memory: FileMemory): Promise<FileMemory>
}

// src/ai/QwenProvider.ts
export class QwenProvider implements AiProvider {
  constructor(modelName?: string)  // default: 'qwen2.5-coder:7b'
  summarize(content: string, language: string): Promise<string>
  compress(memory: FileMemory): Promise<FileMemory>
  isAvailable(): Promise<boolean>
}
```

### Expected Outcomes
- Running "Explain Current File" on a `.ts` file produces an AI-generated summary stored in `FileMemory.summary`
- The summary is concise (not a raw transcript dump)
- If Ollama is not running, the command shows a clear error message — no crash, no hang
- Memory compressor reduces event list when event count exceeds 10

### Todo List
1. Create `src/ai/AiProvider.ts`:
   - Export the `AiProvider` interface (contract above)
2. Create `src/ai/QwenProvider.ts`:
   - Implements `AiProvider`
   - Ollama endpoint: `http://localhost:11434/api/generate` — POST with `{ model, prompt, stream: false }`
   - `summarize()`: prompt = `"Summarise this ${language} file in 3-5 sentences focusing on purpose, key functions, and important constraints:\n\n${content}"`
   - `compress()`: prompt asks Qwen to compress `memory.summary + recent events` into a compact summary, updated decisions and known flaws; parses the result back into `FileMemory` fields
   - `isAvailable()`: attempt a simple HEAD/GET to `http://localhost:11434` — returns boolean, does not throw
   - All fetch errors: catch and rethrow as `Error('Ollama is not running. Start Ollama to use local AI features.')`
3. Fill in `src/memory/MemoryCompressor.ts`:
   - Import `QwenProvider`, call `provider.compress(memory)` when `memory.events.length > 10`
   - Update the store record after compression
   - Export `compressMemory(store: MemoryStore, fileId: string, provider: AiProvider): Promise<void>`
4. Update `src/commands/explainFile.ts` (Agent 1's file):
   - After reading the active file, call `qwenProvider.summarize(content, languageId)` if Qwen is available
   - Store result via `MemoryStore.update(fileId, { summary })`
   - Show summary in output channel; if Qwen unavailable, show file metadata only

### Checkpoint
Open a `.ts` file → "Explain Current File" → AI summary appears in output + stored in `.agent_memory.json`. With Ollama stopped: graceful error, no crash.

---

## Agent 4 — Gemini Provider + Zod Validation + API Key Manager

**Model:** `claude-sonnet-4-5` (security-critical: SecretStorage, no key leakage, strict Zod schemas)
**Phase:** Phase 4
**Status:** `[ ] pending`

### Files to create/modify
- `src/ai/ApiKeyManager.ts` ← **create**
- `src/ai/AiSchemas.ts` ← **create**
- `src/ai/GeminiProvider.ts` ← **create**
- `src/ai/ProviderRouter.ts` ← **create**
- `src/commands/askForChange.ts` ← **create** (minimal — Phase 5 expands it)
- `src/orchestrator/WorkflowState.ts` ← **create**

### Intent
Add Gemini as the cloud reasoning provider. The user provides their own API key; it is stored in VS Code SecretStorage only. Zod validates every response before anything else happens. A minimal "Ask for Change" command proves the flow works before the diff/approval layer is added.

### Contract: what Agent 4 exports
```typescript
// src/ai/ApiKeyManager.ts
export class ApiKeyManager {
  constructor(secrets: vscode.SecretStorage)
  getGeminiKey(): Promise<string | undefined>
  setGeminiKey(key: string): Promise<void>
  clearGeminiKey(): Promise<void>
}

// src/ai/GeminiProvider.ts
export class GeminiProvider {
  constructor(apiKeyManager: ApiKeyManager)
  requestChange(prompt: string, packet: ContextPacket): Promise<AgentResponse>
}

// src/orchestrator/WorkflowState.ts
export class WorkflowState {
  pendingResponse: AgentResponse | undefined
  pendingFilePath: string | undefined
  pendingOriginalContent: string | undefined
  clear(): void
}
```

### Security Rules (non-negotiable)
- `ApiKeyManager` uses `context.secrets.get/store/delete` exclusively
- The Gemini key must never appear in: source code, `settings.json`, output channel, console.log, error messages, or any log
- If the key is not set when a command runs: prompt the user with `vscode.window.showInputBox({ password: true, prompt: 'Enter your Gemini API key' })`, then store via `setGeminiKey`

### Expected Outcomes
- User can set Gemini key via "Tursiops: Set Gemini Key" command; key stored in SecretStorage
- "Ask for Change" sends active file + memory summary to Gemini, receives validated `AgentResponse`
- Zod rejects any response that does not match the schema — no write occurs on bad response
- `WorkflowState` holds the pending response so Phase 5 can pick it up

### Todo List
1. Create `src/ai/ApiKeyManager.ts` (security contract above — no exceptions)
2. Create `src/ai/AiSchemas.ts`:
   - Import `zod`
   - Define `AgentResponseSchema` with exact shape from the shared contracts
   - Export `AgentResponse` type: `z.infer<typeof AgentResponseSchema>`
3. Create `src/ai/GeminiProvider.ts`:
   - REST endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
   - System prompt instructs Gemini to respond with valid JSON only, matching `AgentResponse` shape
   - Parse the response text, run through `AgentResponseSchema.parse()` — if this throws, rethrow as a user-readable error
   - On HTTP error: throw user-readable message (do NOT include the key in the error)
4. Create `src/ai/ProviderRouter.ts`:
   - Export `class ProviderRouter` with:
     - `routeToLocal(task: 'summarize' | 'compress'): AiProvider` → returns `QwenProvider`
     - `routeToCloud(task: 'change'): GeminiProvider` → returns `GeminiProvider`
5. Create `src/orchestrator/WorkflowState.ts`: mutable singleton holding the pending response (contract above)
6. Create `src/commands/askForChange.ts` (minimal version):
   - Register `Tursiops.askForChange`
   - Show input box for user prompt
   - Check key; if missing, trigger set-key flow
   - Build minimal context `{ filePath, language, content, memorySummary, userRequest }`
   - Call `GeminiProvider.requestChange()` — store result in `WorkflowState`
   - Show "Proposed change ready — use 'Review Change' to approve or reject" info message
7. Register `Tursiops.setGeminiKey` command in `extension.ts`

### Checkpoint
Set Gemini key → "Ask for Change" → type a request → `WorkflowState.pendingResponse` is populated with a valid `AgentResponse`. Bad JSON from Gemini is rejected by Zod before reaching `WorkflowState`.

---

## Agent 5 — Diff Preview + User Approval + WorkspaceEdit

**Model:** `claude-sonnet-4-5` (VS Code API-heavy: diff editor, WorkspaceEdit, user interaction flow)
**Phase:** Phase 5
**Status:** `[ ] pending`

### Files to create/modify
- `src/changes/ChangeValidator.ts` ← **create**
- `src/changes/ChangeParser.ts` ← **create**
- `src/changes/DiffPreview.ts` ← **create**
- `src/changes/WorkspaceEditor.ts` ← **create**
- `src/commands/reviewChange.ts` ← **create**
- `src/commands/askForChange.ts` ← **extend** (add diff/approval after Gemini call)

### Intent
Make it structurally impossible for an AI response to silently overwrite a file. The diff is shown first. The user decides. There is no hidden auto-approval path anywhere.

### Contract: what Agent 5 exports
```typescript
// src/changes/DiffPreview.ts
export function showDiff(
  original: string,
  proposed: string,
  filePath: string
): Promise<'approved' | 'rejected'>

// src/changes/WorkspaceEditor.ts
export function applyChange(uri: vscode.Uri, newContent: string): Promise<void>

// src/changes/ChangeValidator.ts
export function validateChange(response: AgentResponse, activeFilePath: string): void
// throws on scope violation, empty content, or unreasonable size

// src/changes/ChangeParser.ts
export function parseChange(response: AgentResponse, originalContent: string): {
  originalContent: string;
  proposedContent: string;
  summary: string;
}
```

### Expected Outcomes
- After "Ask for Change" gets a valid response, a diff editor opens (original vs proposed)
- Information message shows "✅ Approve" and "❌ Reject" buttons
- Reject: file is not touched, "Change rejected — file unchanged" shown
- Approve: `WorkspaceEdit` applies the change; memory event appended
- Scope guard: if `AgentResponse.updatedFile` does not match the active file path, the change is auto-rejected with an error

### Todo List
1. Create `src/changes/ChangeValidator.ts`:
   - `validateChange(response, activeFilePath)`: throws if target file ≠ active file, if content is empty, or if content is > 5× original length
2. Create `src/changes/ChangeParser.ts`:
   - `parseChange(response, originalContent)`: returns `{ originalContent, proposedContent: response.updatedFile content, summary: response.summary }`
   - Note: `AgentResponse.updatedFile` contains the **full new file content** (not a patch) — this must be clear in the Gemini prompt
3. Create `src/changes/DiffPreview.ts`:
   - Write `originalContent` and `proposedContent` to temp files in `os.tmpdir()`
   - Call `vscode.commands.executeCommand('vscode.diff', originalUri, proposedUri, 'Tursiops: Proposed Change')`
   - Show info message with "✅ Approve" and "❌ Reject" buttons via `vscode.window.showInformationMessage`
   - Return the user's choice; if message is dismissed without choice, return `'rejected'`
   - Clean up temp files after the choice is made
4. Create `src/changes/WorkspaceEditor.ts`:
   - `applyChange(uri, newContent)`: uses `new vscode.WorkspaceEdit()` with `edit.replace(uri, fullRange, newContent)` and `vscode.workspace.applyEdit(edit)`
   - Never uses raw `fs.writeFile`
5. Create `src/commands/reviewChange.ts`:
   - Register `Tursiops.reviewChange`
   - If `WorkflowState.pendingResponse` exists: re-run the diff/approval flow
   - If nothing pending: show "No pending change to review"
6. Extend `src/commands/askForChange.ts`:
   - After `WorkflowState` is populated: call `validateChange`, `parseChange`, `showDiff`
   - If approved: call `applyChange`, append memory event `{ type: 'change', summary }`
   - If rejected: show info message

### Checkpoint
"Ask for Change" → diff editor opens → click Reject → file unchanged → ask again → click Approve → file changes exactly as shown in diff.

---

## Agent 6 — Validation Loop (Type-check + Lint + Correction Cap)

**Model:** `claude-sonnet-4-5` (child_process handling, orchestration logic, loop-cap correctness)
**Phase:** Phase 6
**Status:** `[ ] pending`

### Files to create/modify
- `src/validation/ValidationResult.ts` ← **create**
- `src/validation/LintRunner.ts` ← **create**
- `src/validation/TestRunner.ts` ← **create**
- `src/orchestrator/AgentOrchestrator.ts` ← **create**
- `src/commands/askForChange.ts` ← **refactor** to delegate to orchestrator

### Intent
After an approved change is applied, validate it automatically. If it fails, send errors back to Gemini for a correction — but cap this at exactly 3 attempts. No infinite loops. Record the outcome in memory.

### Contract: what Agent 6 exports
```typescript
// src/orchestrator/AgentOrchestrator.ts
export const MAX_CORRECTION_ATTEMPTS = 3;

export interface OrchestratorOptions {
  activeFile: ActiveFile;
  memory: FileMemory;
  userPrompt: string;
  geminiProvider: GeminiProvider;
  memoryStore: MemoryStore;
  workspaceRoot: string;
}

export class AgentOrchestrator {
  runWithValidation(options: OrchestratorOptions): Promise<void>
}
```

### Expected Outcomes
- After approve: `npm run check-types` and `npm run lint` run automatically
- If both pass: success event recorded in memory
- If either fails: errors sent to Gemini as correction context; new proposal shown to user
- After 3 failed correction attempts: stop, show "Correction limit reached — manual fix required", record failure event
- Correction attempt count shown in output channel

### Todo List
1. Create `src/validation/ValidationResult.ts`: export `ValidationResult` interface (per shared contracts)
2. Create `src/validation/LintRunner.ts`:
   - Export `runLint(workspaceRoot: string): Promise<ValidationResult>`
   - Use `child_process.spawn('npm', ['run', 'lint'], { cwd: workspaceRoot })`
   - Capture stdout + stderr as string stream
   - Return `{ passed: exitCode === 0, command: 'npm run lint', exitCode, output }`
3. Create `src/validation/TestRunner.ts`:
   - Export `runTypeCheck(workspaceRoot: string): Promise<ValidationResult>`
   - Same pattern, command: `npm run check-types`
4. Create `src/orchestrator/AgentOrchestrator.ts`:
   - `MAX_CORRECTION_ATTEMPTS = 3` (named constant — not a magic number)
   - `runWithValidation(options)`:
     1. Call Gemini → validate → show diff → if rejected: return
     2. If approved: apply change
     3. Run `runTypeCheck` and `runLint`
     4. If both pass: append success `MemoryEvent`, return
     5. If fail and `attempt < MAX_CORRECTION_ATTEMPTS`: build correction prompt with errors, increment attempt, go to step 1
     6. If fail at cap: append failure `MemoryEvent`, show "Correction limit reached" warning, return
5. Refactor `src/commands/askForChange.ts`:
   - Replace current body with: build `OrchestratorOptions`, call `agentOrchestrator.runWithValidation(options)`

### Checkpoint
Apply a change that introduces a type error → validation fails → Gemini gets correction context → new diff shown → after 3 failures → "Correction limit reached" shown. Apply a valid change → validation passes → success event in memory.

---

## Agent 7 — Related-File Context + Secret Filter + Context Packet

**Model:** `claude-sonnet-4-5` (security-critical: secret filtering must be airtight; regex import parsing)
**Phase:** Phase 7
**Status:** `[ ] pending`

### Files to create/modify
- `src/context/SecretFilter.ts` ← **create**
- `src/context/RelatedFileResolver.ts` ← **create**
- `src/context/TokenBudget.ts` ← **create**
- `src/context/ContextBuilder.ts` ← **create**
- `src/artifacts/ContextPacket.ts` ← **create** (define shared interface)
- `src/artifacts/ArtifactStore.ts` ← **create** (stub)
- `src/orchestrator/AgentOrchestrator.ts` ← **extend** (use full context packet)

### Intent
Give Gemini narrow, relevant neighbouring context. Resolve direct imports from the active file. Never let secret-looking files anywhere near the AI context. Enforce a token budget so context stays compact.

### Contract: what Agent 7 exports
```typescript
// src/context/SecretFilter.ts
export function isSecretFile(filePath: string): boolean
export function filterSecretFiles(paths: string[]): string[]

// Secret patterns: .env, *.env, *.pem, *.key, *.p12, *.pfx, id_rsa,
//                  id_ed25519, credentials.json, .netrc, *.secret

// src/context/RelatedFileResolver.ts
export function resolveRelatedFiles(
  activeFilePath: string,
  workspaceRoot: string,
  maxFiles?: number   // default: 5
): Promise<string[]>

// src/context/ContextBuilder.ts
export function buildContextPacket(
  activeFile: ActiveFile,
  memory: FileMemory,
  relatedFiles: Array<{ path: string; content: string }>,
  userPrompt: string
): ContextPacket
```

### Expected Outcomes
- When Gemini is called, the context packet includes content of files directly imported by the active file (up to 5)
- A `.env` file is never included in the context packet even if it appears in imports
- Total related-file content is capped by token budget (character-count approximation: 1 token ≈ 4 chars, budget: 8000 tokens for related files)
- `ContextPacket` replaces the minimal context object previously used in `askForChange`

### Todo List
1. Create `src/artifacts/ContextPacket.ts`:
   - Export the `ContextPacket` interface (per shared contracts)
2. Create `src/artifacts/ArtifactStore.ts`:
   - Stub: export class `ArtifactStore` with `store(id: string, content: string)` and `get(id: string): string | undefined` using an in-memory `Map`
3. Create `src/context/SecretFilter.ts`:
   - Pattern list: `.env`, `*.env`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `credentials.json`, `.netrc`, `*.secret`
   - `isSecretFile(filePath)`: check `path.basename(filePath)` against the pattern list using minimatch-style logic (implement manually with `endsWith`/`===` — do not add a new dependency)
   - `filterSecretFiles(paths)`: returns paths where `!isSecretFile(path)` and path does not contain `node_modules`
4. Create `src/context/RelatedFileResolver.ts`:
   - Parse active file content for `import ... from '...'` and `require('...')` using regex
   - Extract relative paths (skip `node_modules`, absolute paths, non-`.ts`/`.js`/`.tsx`/`.jsx` extensions)
   - Resolve each relative path to absolute using `path.resolve(path.dirname(activeFilePath), importPath)`
   - Filter results through `filterSecretFiles`
   - Read each file; return up to `maxFiles` (default 5) results
5. Create `src/context/TokenBudget.ts`:
   - `estimateTokens(content: string): number` — `Math.ceil(content.length / 4)`
   - `fitToTokenBudget(items: Array<{path, content}>, budgetTokens: number): Array<{path, content}>` — include items greedily until budget exhausted; prefer shorter files (sort by length ascending first)
6. Create `src/context/ContextBuilder.ts`:
   - `buildContextPacket(activeFile, memory, relatedFiles, userPrompt): ContextPacket`
   - Generates `requestId` with `crypto.randomUUID()`
   - Populates all fields per the `ContextPacket` interface
   - Limits `memory.recentEvents` to last 5 events
7. Extend `src/orchestrator/AgentOrchestrator.ts`:
   - Before calling Gemini: call `resolveRelatedFiles`, apply `filterSecretFiles`, read file contents, apply `fitToTokenBudget`, call `buildContextPacket`
   - Pass the full `ContextPacket` to `GeminiProvider.requestChange()`
   - Update `GeminiProvider.requestChange()` signature to accept `ContextPacket`

### Checkpoint
Open a `.ts` file that imports another file → "Ask for Change" → context packet includes the imported file. Place a `.env` in the workspace → confirm it never appears in any context sent to Gemini. Output channel shows which related files were included.

---

## Agent 8 — Integration, Wiring, and Final Type-Check Pass

**Model:** `claude-sonnet-4-5` (needs full codebase view, type-error resolution, import chain fixing)
**Phase:** Integration
**Status:** `[ ] pending`

### Files to modify
- `src/extension.ts` ← **complete rewrite** (wire all 7 agents' command registrations + initialization)
- `package.json` ← **finalize** (all commands, correct activationEvents, add runtime deps)
- All `src/` files ← **fix type errors and import mismatches**
- `.gitignore` ← **verify**

### Intent
Agent 8 runs after all 7 specialist agents are done. Its job is purely integration — connect all the pieces, resolve cross-agent type mismatches, ensure the full end-to-end flow works, and produce a codebase that passes `check-types` and `lint` with zero errors.

### What Agent 8 does NOT do
- Does not redesign any agent's implementation
- Does not add new features
- Does not change any agent's exported interface contract
- Only fixes what is broken at the seams

### Expected Outcomes
- `npm run check-types` → zero errors
- `npm run lint` → zero errors
- Full end-to-end flow works: open file → Explain → Show Memory → Ask for Change → diff → approve/reject → validation → memory updated
- No API key appears in any log
- No crash when workspace has no folder open
- `.agent_memory.json` is in `.gitignore` and not committed

### Todo List
1. **Install runtime dependencies** first:
   - `npm install zod diff` (adds to `dependencies` in `package.json`)
2. **Complete `src/extension.ts`**:
   - Import and register all commands from all 7 agents: `registerExplainFile`, `registerShowMemory`, `registerClearFileMemory`, `registerAskForChange`, `registerReviewChange`, `registerSetGeminiKey`
   - Instantiate shared singletons: `MemoryStore`, `ApiKeyManager`, `QwenProvider`, `GeminiProvider`, `ProviderRouter`, `AgentOrchestrator`, `WorkflowState`
   - Pass singletons to command registrations that need them
   - Add workspace trust guard: if `!vscode.workspace.isTrusted` → show warning, skip AI feature registration
   - Add graceful no-folder guard: if no `workspaceFolders` → show warning on any memory/AI command
3. **Finalize `package.json` `contributes.commands`**:
   - Verify all 6 commands are listed: `explainFile`, `showMemory`, `clearFileMemory`, `askForChange`, `reviewChange`, `setGeminiKey`
   - `activationEvents: ["onStartupFinished"]`
4. **Resolve cross-agent type mismatches**:
   - Run `npm run check-types`, read every error, fix import paths and type mismatches
   - Common issues to check: `ContextPacket` interface imported from the correct location, `FileMemory` type consistent everywhere, `AgentResponse` used from `AiSchemas.ts` not re-declared elsewhere
5. **Resolve lint errors**:
   - Run `npm run lint`, fix all reported issues
6. **Security audit**:
   - Grep for any usage of `console.log` in `src/` — replace with `log()` from `logging.ts`
   - Grep for any string that looks like an API key pattern
   - Verify `ApiKeyManager` is the only file that calls `context.secrets`
7. **Verify `.gitignore`**:
   - Must contain: `.agent_memory.json`, `.agent_memory.json.tmp`, `dist/`, `out/`, `node_modules/`
8. **Run full end-to-end manual test** and record results:
   - Open a `.ts` file
   - "Explain Current File" → file info + Qwen summary in output
   - "Show Memory" → memory record displayed
   - "Ask for Change" → diff shown → Reject → file unchanged
   - "Ask for Change" again → Approve → file changes
   - Validation runs → result in output
   - "Show Memory" again → change event recorded

### Checkpoint
`npm run check-types` → 0 errors. `npm run lint` → 0 errors. Full end-to-end flow works. No keys in logs. Workspace trust respected.

---

## Agent Model Assignment Summary

| Agent | Phase | Specialty | Model |
|-------|-------|-----------|-------|
| Agent 1 | Phase 1 | VS Code API — active file, output channel, command palette | `claude-sonnet-4-5` |
| Agent 2 | Phase 2 | Data integrity — atomic writes, file identity, persistent memory | `claude-sonnet-4-5` |
| Agent 3 | Phase 3 | Local AI — Ollama HTTP client, error handling, compression | `claude-sonnet-4-5` |
| Agent 4 | Phase 4 | Security + Zod — SecretStorage, key management, schema validation | `claude-sonnet-4-5` |
| Agent 5 | Phase 5 | VS Code diff editor — WorkspaceEdit, approval flow, temp files | `claude-sonnet-4-5` |
| Agent 6 | Phase 6 | Orchestration — child_process, loop cap, correction retry | `claude-sonnet-4-5` |
| Agent 7 | Phase 7 | Context + security — import parsing, secret filtering, token budget | `claude-sonnet-4-5` |
| Agent 8 | Integration | Full wiring — type resolution, import chains, end-to-end test | `claude-sonnet-4-5` |

---

## Dependency Graph (what each agent needs from others)

```
Agent 1 ──────────────────────────────────────────► Agent 8
  exports: ActiveFile, readActiveFile()

Agent 2 ──────────────────────────────────────────► Agent 8
  exports: MemoryStore, FileMemory, MemoryEvent
  uses: Agent 1 (ActiveFile type)

Agent 3 ──────────────────────────────────────────► Agent 8
  exports: AiProvider, QwenProvider
  uses: Agent 2 (FileMemory — for compress())
  fills: Agent 2's MemoryCompressor stub

Agent 4 ──────────────────────────────────────────► Agent 8
  exports: ApiKeyManager, GeminiProvider, WorkflowState, AgentResponse
  uses: Agent 2 (FileMemory), Agent 3 (AiProvider interface)

Agent 5 ──────────────────────────────────────────► Agent 8
  exports: showDiff(), applyChange(), validateChange(), parseChange()
  uses: Agent 4 (AgentResponse, WorkflowState)

Agent 6 ──────────────────────────────────────────► Agent 8
  exports: AgentOrchestrator, MAX_CORRECTION_ATTEMPTS
  uses: Agents 1, 2, 4, 5 — coordinates them all

Agent 7 ──────────────────────────────────────────► Agent 8
  exports: SecretFilter, RelatedFileResolver, ContextBuilder, ContextPacket
  uses: Agents 1, 2 — extends orchestrator in Agent 6

                    Agent 8
          wires all agents into extension.ts
          fixes seam-level type errors
          runs check-types + lint to zero errors
```

---

## Files Per Agent (No Overlaps)

| File | Owner |
|------|-------|
| `src/context/ActiveFileReader.ts` | Agent 1 |
| `src/commands/explainFile.ts` | Agent 1 |
| `src/utils/logging.ts` | Agent 1 |
| `src/utils/hashing.ts` | Agent 2 |
| `src/utils/paths.ts` | Agent 2 |
| `src/memory/MemorySchema.ts` | Agent 2 |
| `src/memory/FileIdentity.ts` | Agent 2 |
| `src/memory/MemoryStore.ts` | Agent 2 |
| `src/memory/MemoryUpdater.ts` | Agent 2 |
| `src/memory/MemoryCompressor.ts` | Agent 2 (stub) → Agent 3 (fills) |
| `src/commands/showMemory.ts` | Agent 2 |
| `src/commands/clearFileMemory.ts` | Agent 2 |
| `src/ai/AiProvider.ts` | Agent 3 |
| `src/ai/QwenProvider.ts` | Agent 3 |
| `src/ai/ApiKeyManager.ts` | Agent 4 |
| `src/ai/AiSchemas.ts` | Agent 4 |
| `src/ai/GeminiProvider.ts` | Agent 4 |
| `src/ai/ProviderRouter.ts` | Agent 4 |
| `src/orchestrator/WorkflowState.ts` | Agent 4 |
| `src/commands/askForChange.ts` | Agent 4 (create) → Agent 5 (extend) → Agent 6 (refactor) |
| `src/changes/ChangeValidator.ts` | Agent 5 |
| `src/changes/ChangeParser.ts` | Agent 5 |
| `src/changes/DiffPreview.ts` | Agent 5 |
| `src/changes/WorkspaceEditor.ts` | Agent 5 |
| `src/commands/reviewChange.ts` | Agent 5 |
| `src/validation/ValidationResult.ts` | Agent 6 |
| `src/validation/LintRunner.ts` | Agent 6 |
| `src/validation/TestRunner.ts` | Agent 6 |
| `src/orchestrator/AgentOrchestrator.ts` | Agent 6 (create) → Agent 7 (extend) |
| `src/context/SecretFilter.ts` | Agent 7 |
| `src/context/RelatedFileResolver.ts` | Agent 7 |
| `src/context/TokenBudget.ts` | Agent 7 |
| `src/context/ContextBuilder.ts` | Agent 7 |
| `src/artifacts/ContextPacket.ts` | Agent 7 |
| `src/artifacts/ArtifactStore.ts` | Agent 7 |
| `src/extension.ts` | Agent 8 (complete wiring) |
| `package.json` | Agent 8 (finalize) |

---

## Execution Order

Agents 1, 2, 3 can run in parallel (no cross-dependencies).
Agent 4 starts after Agent 2 and 3 are done.
Agent 5 starts after Agent 4 is done.
Agent 6 starts after Agent 5 is done.
Agent 7 starts after Agent 6 is done.
Agent 8 starts only after all 7 specialists are done.

```
[Agent 1] ─────────────────────────────────┐
[Agent 2] ──────────────────────────────── │ ──► [Agent 4] ──► [Agent 5] ──► [Agent 6] ──► [Agent 7] ──► [Agent 8]
[Agent 3] ─── fills Agent 2 stub ───────── │
                                            └───────────────────────────────────────────────────────────────────
```
