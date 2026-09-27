import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

// ---------------------------------------------------------------------------
// Folder structure
//   .tursiops/
//   ├── memory/
//   │   ├── remember.md
//   │   └── forget.md
//   └── changes/
//       ├── change_1.md   ← diff between prompt 1 → prompt 2
//       ├── change_2.md   ← diff between prompt 2 → prompt 3
//       └── ...
// ---------------------------------------------------------------------------

function cwd(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

export function tursiopsRoot(): string | null {
  const w = cwd();
  return w ? path.join(w, '.tursiops') : null;
}

export function memoryDir(): string | null {
  const root = tursiopsRoot();
  if (!root) { return null; }
  const dir = path.join(root, 'memory');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function changesDir(): string | null {
  const root = tursiopsRoot();
  if (!root) { return null; }
  const dir = path.join(root, 'changes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function exec(cmd: string): string {
  try {
    return cp.execSync(cmd, { cwd: cwd(), encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }).trim();
  } catch {
    return '';
  }
}

export function gitCommitList(): CommitInfo[] {
  const raw = exec('git log --oneline -20');
  if (!raw) { return []; }
  return raw.split('\n').map(line => {
    const spaceIdx = line.indexOf(' ');
    return {
      hash:    line.slice(0, spaceIdx),
      message: line.slice(spaceIdx + 1).trim(),
    };
  });
}

export function gitDiffSinceLastCommit(): string {
  // staged + unstaged changes vs HEAD
  const staged   = exec('git diff --cached');
  const unstaged = exec('git diff');
  return [staged, unstaged].filter(Boolean).join('\n\n') || 'No changes detected.';
}

export function gitDiffBetweenCommits(hashA: string, hashB: string): string {
  return exec(`git diff ${hashA} ${hashB}`) || 'No differences between these commits.';
}

export function currentCommitHash(): string {
  return exec('git rev-parse --short HEAD') || 'no-commit';
}

export function currentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD') || 'unknown';
}

// ---------------------------------------------------------------------------
// Change file management
// ---------------------------------------------------------------------------
export interface ChangeEntry {
  index:     number;
  timestamp: string;
  commit:    string;
  branch:    string;
  prompt:    string;   // the refined prompt that triggered the change
  diff:      string;   // raw git diff
  summary:   string;   // Gemini summary (filled in async)
}

function changeFilePath(index: number): string | null {
  const dir = changesDir();
  return dir ? path.join(dir, `change_${index}.md`) : null;
}

function renderChangeFile(entry: ChangeEntry): string {
  return `# Change #${entry.index}

**Time:** ${entry.timestamp}
**Commit:** ${entry.commit}
**Branch:** ${entry.branch}
**Prompt:** ${entry.prompt}

## Gemini Summary
${entry.summary || '*Generating…*'}

## Raw Diff
\`\`\`diff
${entry.diff}
\`\`\`
`;
}

export function loadAllChanges(): ChangeEntry[] {
  const dir = changesDir();
  if (!dir) { return []; }
  const entries: ChangeEntry[] = [];
  const files = fs.readdirSync(dir).filter(f => /^change_\d+\.md$/.test(f));
  files.sort((a, b) => {
    const ai = parseInt(a.match(/\d+/)?.[0] ?? '0');
    const bi = parseInt(b.match(/\d+/)?.[0] ?? '0');
    return ai - bi;
  });
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const idx     = parseInt(f.match(/\d+/)?.[0] ?? '0');
    const ts      = content.match(/^\*\*Time:\*\* (.+)$/m)?.[1]?.trim() ?? '';
    const commit  = content.match(/^\*\*Commit:\*\* (.+)$/m)?.[1]?.trim() ?? '';
    const branch  = content.match(/^\*\*Branch:\*\* (.+)$/m)?.[1]?.trim() ?? '';
    const prompt  = content.match(/^\*\*Prompt:\*\* (.+)$/m)?.[1]?.trim() ?? '';
    const summary = content.match(/## Gemini Summary\n([\s\S]*?)(?=\n## Raw Diff)/)?.[1]?.trim() ?? '';
    const diff    = content.match(/```diff\n([\s\S]*?)```/)?.[1]?.trim() ?? '';
    entries.push({ index: idx, timestamp: ts, commit, branch, prompt, diff, summary });
  }
  return entries;
}

export async function captureChange(
  refinedPrompt: string,
  geminiKey: string,
): Promise<ChangeEntry | null> {
  const dir = changesDir();
  if (!dir) { return null; }

  const existing = loadAllChanges();
  const index    = existing.length + 1;
  const diff     = gitDiffSinceLastCommit();
  const entry: ChangeEntry = {
    index,
    timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
    commit:    currentCommitHash(),
    branch:    currentBranch(),
    prompt:    refinedPrompt,
    diff,
    summary:   '',
  };

  // Write immediately with placeholder summary
  const filePath = changeFilePath(index)!;
  fs.writeFileSync(filePath, renderChangeFile(entry), 'utf8');

  // Generate Gemini summary async, then update file
  if (diff !== 'No changes detected.' && geminiKey) {
    try {
      entry.summary = await summariseDiff(diff, refinedPrompt, geminiKey);
      fs.writeFileSync(filePath, renderChangeFile(entry), 'utf8');
    } catch { /* leave placeholder */ }
  } else {
    entry.summary = diff === 'No changes detected.'
      ? 'No file changes detected since last commit.'
      : 'No Gemini key — raw diff only.';
    fs.writeFileSync(filePath, renderChangeFile(entry), 'utf8');
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Gemini: summarise diff in plain English
// ---------------------------------------------------------------------------
async function summariseDiff(diff: string, prompt: string, geminiKey: string): Promise<string> {
  // Trim diff to avoid exceeding token limits
  const trimmedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n...(truncated)' : diff;

  const text = `You are a code change analyst. Given a git diff and the prompt that caused the changes, write a concise bullet-point summary of what was changed in the code.

Prompt that triggered changes: "${prompt}"

Git diff:
${trimmedDiff}

Instructions:
- Write 3-6 bullet points max
- Each bullet: what changed and why (based on the prompt)
- Be specific about file names and what was added/removed/modified
- No preamble, no markdown headers, just bullet points starting with -`;

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) { return 'Could not generate summary.'; }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Could not generate summary.';
}

// ---------------------------------------------------------------------------
// Fn 3 — Change Summary: summarise changes between two commits using Gemini
// ---------------------------------------------------------------------------
export async function summariseBetweenCommits(
  hashA: string,
  hashB: string,
  geminiKey: string,
): Promise<string> {
  const diff = gitDiffBetweenCommits(hashA, hashB);
  if (!diff || diff === 'No differences between these commits.') {
    return 'No differences found between these commits.';
  }

  const trimmedDiff = diff.length > 10000 ? diff.slice(0, 10000) + '\n...(truncated)' : diff;

  const text = `You are a code review assistant. Summarise the following git diff between two commits into a clear, organised report.

Git diff:
${trimmedDiff}

Instructions:
- Group changes by file
- For each file: briefly describe what was added, removed, or modified
- End with a 1-2 sentence overall summary
- Use markdown formatting with file names as headers
- Be concise but complete`;

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) { return 'Could not generate summary.'; }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Could not generate summary.';
}

// ---------------------------------------------------------------------------
// Reset on commit — delete changes files + memory files, create fresh
// ---------------------------------------------------------------------------
export function resetOnCommit(): void {
  const root = tursiopsRoot();
  if (!root || !fs.existsSync(root)) { return; }

  const memDir = path.join(root, 'memory');
  const chgDir = path.join(root, 'changes');

  // Delete all files in both dirs
  for (const dir of [memDir, chgDir]) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
  }

  // Create fresh empty memory files
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'remember.md'),
    '# 🧠 Prompt Memory — Remember\n\n> Auto-managed by Tursiops. Read by AI agent.\n\n*No prompts yet.*\n', 'utf8');
  fs.writeFileSync(path.join(memDir, 'forget.md'),
    '# 🗑️ Prompt Memory — Forget\n\n> Auto-managed by Tursiops. Read by AI agent.\n\n*No prompts yet.*\n', 'utf8');

  vscode.window.showInformationMessage('Tursiops: Commit detected — memory and changes reset for fresh session.');
}

// ---------------------------------------------------------------------------
// Expose interface for CommitInfo
// ---------------------------------------------------------------------------
export interface CommitInfo {
  hash:    string;
  message: string;
}

// ---------------------------------------------------------------------------
// Git watcher — resets memory + changes on every commit
// ---------------------------------------------------------------------------
export function watchGitReset(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }
  const workspaceCwd = folders[0].uri.fsPath;
  const gitDir       = path.join(workspaceCwd, '.git');
  if (!fs.existsSync(gitDir)) { return; }

  const commitMsg = path.join(gitDir, 'COMMIT_EDITMSG');
  let lastMtime   = fs.existsSync(commitMsg) ? fs.statSync(commitMsg).mtimeMs : 0;
  let fsWatcher: fs.FSWatcher | undefined;

  const start = () => {
    try {
      fsWatcher = fs.watch(gitDir, (_event, filename) => {
        if (filename !== 'COMMIT_EDITMSG') { return; }
        if (!fs.existsSync(commitMsg)) { return; }
        const newMtime = fs.statSync(commitMsg).mtimeMs;
        if (newMtime === lastMtime) { return; }
        lastMtime = newMtime;
        resetOnCommit();
      });
      fsWatcher.on('error', () => { fsWatcher?.close(); setTimeout(start, 3000); });
    } catch { /* no git repo */ }
  };

  start();
  context.subscriptions.push({ dispose: () => fsWatcher?.close() });
}
