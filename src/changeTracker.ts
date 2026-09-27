import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as diffLib from 'diff';

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

export function snapshotsDir(): string | null {
  const root = tursiopsRoot();
  if (!root) { return null; }
  const dir = path.join(root, 'snapshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const IGNORED_NAMES = new Set([
  '.git', '.tursiops', 'node_modules', '.vscode', 'out', 'dist',
  'package-lock.json', '.DS_Store', 'Thumbs.db'
]);

function scanWorkspace(dir: string, rootDir: string, map: Record<string, string> = {}): Record<string, string> {
  if (!fs.existsSync(dir)) { return map; }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (IGNORED_NAMES.has(ent.name)) { continue; }
    const fullPath = path.join(dir, ent.name);
    const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      scanWorkspace(fullPath, rootDir, map);
    } else if (ent.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size <= 10 * 1024 * 1024) {
          map[rel] = fs.readFileSync(fullPath, 'utf8');
        }
      } catch {}
    }
  }
  return map;
}

export function captureSnapshot(index: number): Record<string, string> {
  const root = cwd();
  const dir = snapshotsDir();
  if (!root || !dir) { return {}; }
  const current = scanWorkspace(root, root);
  const snapPath = path.join(dir, index + '.json');
  fs.writeFileSync(snapPath, JSON.stringify(current), 'utf8');
  return current;
}

export function getSnapshot(index: number): Record<string, string> | null {
  const dir = snapshotsDir();
  if (!dir) { return null; }
  const snapPath = path.join(dir, index + '.json');
  if (!fs.existsSync(snapPath)) { return null; }
  try {
    return JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Record<string, string>;
  } catch {
    return null;
  }
}

export function computeDiffBetweenSnapshots(
  snapA: Record<string, string>,
  snapB: Record<string, string>
): string {
  const allFiles = Array.from(new Set([...Object.keys(snapA), ...Object.keys(snapB)])).sort();
  let fullDiff = '';
  for (const file of allFiles) {
    const textA = snapA[file] ?? '';
    const textB = snapB[file] ?? '';
    if (textA !== textB) {
      const patch = diffLib.createPatch(file, textA, textB, 'Prompt ' + (snapA ? 'Start' : 'Baseline'), 'Prompt Completed', { context: 5 });
      fullDiff += patch + '\n';
    }
  }
  return fullDiff.trim() || 'No file changes detected.';
}

function exec(cmd: string): string {
  try {
    return cp.execSync(cmd, { cwd: cwd(), encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }).trim();
  } catch {
    return '';
  }
}

export function currentCommitHash(): string {
  return exec('git rev-parse --short HEAD') || 'no-commit';
}

export function currentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD') || 'unknown';
}

export interface ChangeEntry {
  index:     number;
  timestamp: string;
  commit:    string;
  branch:    string;
  prompt:    string;
  diff:      string;
  summary:   string;
}

function changeFilePath(index: number): string | null {
  const dir = changesDir();
  return dir ? path.join(dir, 'change_' + index + '.md') : null;
}

function renderChangeFile(entry: ChangeEntry): string {
  // Extract list of changed files from diff headers
  const changedFiles: string[] = [];
  const regex = /^Index: (.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(entry.diff)) !== null) {
    changedFiles.push(match[1].trim());
  }

  const filesSection = changedFiles.length > 0
    ? '## Modified Files (' + changedFiles.length + ')\n' + changedFiles.map(f => '- `' + f + '`').join('\n') + '\n\n'
    : '## Modified Files\n*No files modified.*\n\n';

  return '# Change #' + entry.index + '\n\n' +
    '**Time:** ' + entry.timestamp + '\n' +
    '**Commit:** ' + entry.commit + '\n' +
    '**Branch:** ' + entry.branch + '\n' +
    '**Prompt:** ' + entry.prompt + '\n\n' +
    '## Gemini Summary\n' +
    (entry.summary || '*Generating…*') + '\n\n' +
    filesSection +
    '## Complete Changes Diff\n' +
    'To revert or apply these changes, instruct your IDE agent using the diff below:\n\n' +
    '```diff\n' +
    entry.diff + '\n' +
    '```\n';
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
    const diffMatch = content.match(/```diff\n([\s\S]*?)```/);
    const diff    = diffMatch ? diffMatch[1].trim() : '';
    entries.push({ index: idx, timestamp: ts, commit, branch, prompt, diff, summary });
  }
  return entries;
}

// Active prompt tracking: watches for AI agent modifications after prompt submission
let activePromptWatcher: vscode.FileSystemWatcher | null = null;
let activePromptDebounce: NodeJS.Timeout | null = null;

export async function captureChange(
  promptIndex: number,
  refinedPrompt: string,
  geminiKey: string,
  onUpdated?: () => void
): Promise<ChangeEntry | null> {
  const dir = changesDir();
  if (!dir) { return null; }

  // 1. Snapshot BEFORE the agent touches files (baseline for this prompt)
  // If baseline 0 is missing, take it right now
  let baseline = getSnapshot(promptIndex - 1) || getSnapshot(0);
  if (!baseline || Object.keys(baseline).length === 0) {
    baseline = captureSnapshot(0);
  }

  // 2. Initial record for this prompt
  const filePath = changeFilePath(promptIndex)!;
  const updateFileDiff = async () => {
    const latestSnapshot = captureSnapshot(promptIndex);
    const diff = computeDiffBetweenSnapshots(baseline!, latestSnapshot);

    const entry: ChangeEntry = {
      index:     promptIndex,
      timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
      commit:    currentCommitHash(),
      branch:    currentBranch(),
      prompt:    refinedPrompt,
      diff,
      summary:   '',
    };

    if (diff !== 'No file changes detected.' && geminiKey) {
      try {
        entry.summary = await summariseDiff(diff, refinedPrompt, geminiKey);
      } catch {
        entry.summary = 'Changes detected — generating summary…';
      }
    } else {
      entry.summary = diff === 'No file changes detected.'
        ? 'Waiting for AI agent to modify files…'
        : 'No Gemini key — raw diff only.';
    }

    fs.writeFileSync(filePath, renderChangeFile(entry), 'utf8');
    if (onUpdated) { onUpdated(); }
    return entry;
  };

  // Perform initial capture
  const entry = await updateFileDiff();

  // 3. Start a live workspace file watcher so when the IDE agent finishes writing code,
  // the change file & Gemini summary automatically capture the changes!
  if (activePromptWatcher) {
    activePromptWatcher.dispose();
  }

  activePromptWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  const triggerDebounced = () => {
    if (activePromptDebounce) { clearTimeout(activePromptDebounce); }
    activePromptDebounce = setTimeout(async () => {
      await updateFileDiff();
    }, 1500); // Wait 1.5s after agent stops writing
  };

  activePromptWatcher.onDidChange(triggerDebounced);
  activePromptWatcher.onDidCreate(triggerDebounced);
  activePromptWatcher.onDidDelete(triggerDebounced);

  return entry;
}

const FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

async function callGemini(
  promptText: string,
  geminiKey: string,
  maxOutputTokens = 512,
  temperature = 0.2
): Promise<string | null> {
  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  for (const model of FALLBACK_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return text;
        }
      }
    } catch {}
  }
  return null;
}

async function summariseDiff(diff: string, prompt: string, geminiKey: string): Promise<string> {
  const trimmedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n...(truncated)' : diff;
  const text = 'You are an AI development assistant. Explain what code changes were made by the AI agent after receiving this prompt.\n\n' +
    'Prompt: "' + prompt + '"\n\n' +
    'Code Diff:\n' + trimmedDiff + '\n\n' +
    'Instructions:\n- Write 3-5 concise bullet points detailing exactly what the agent created, modified, or deleted.\n- Mention affected files and components.\n- Start each bullet point with "- ".';

  const res = await callGemini(text, geminiKey, 512, 0.2);
  return res ?? 'Could not generate summary.';
}

export async function summariseBetweenPrompts(
  promptA: number,
  promptB: number,
  geminiKey: string,
): Promise<string> {
  const fromIdx = Math.min(promptA, promptB);
  const toIdx   = Math.max(promptA, promptB);

  const snapA = getSnapshot(fromIdx - 1) || getSnapshot(fromIdx) || {};
  const snapB = getSnapshot(toIdx) || {};

  const diff = computeDiffBetweenSnapshots(snapA, snapB);
  if (!diff || diff === 'No file changes detected.') {
    return 'No file changes detected between Prompt #' + fromIdx + ' and Prompt #' + toIdx + '.';
  }

  const trimmedDiff = diff.length > 10000 ? diff.slice(0, 10000) + '\n...(truncated)' : diff;
  const text = 'You are a code review assistant. Summarise all the changes the AI agent made between Prompt #' + fromIdx + ' and Prompt #' + toIdx + '.\n\n' +
    'Changes Diff:\n' + trimmedDiff + '\n\n' +
    'Instructions:\n- Group changes by file.\n- Explain what was added, modified, or refactored.\n- Provide a concise overall conclusion at the end.';

  const res = await callGemini(text, geminiKey, 1024, 0.2);
  return res ?? 'Could not generate summary.';
}

export function resetOnCommit(): void {
  const root = tursiopsRoot();
  if (!root || !fs.existsSync(root)) { return; }

  const memDir  = path.join(root, 'memory');
  const chgDir  = path.join(root, 'changes');
  const snapDir = path.join(root, 'snapshots');

  for (const dir of [memDir, chgDir, snapDir]) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch {}
      }
    }
  }

  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'remember.md'),
    '# 🧠 Prompt Memory — Remember\n\n> Auto-managed by Tursiops. Read by AI agent.\n\n*No prompts yet.*\n', 'utf8');
  fs.writeFileSync(path.join(memDir, 'forget.md'),
    '# 🗑️ Prompt Memory — Forget\n\n> Auto-managed by Tursiops. Read by AI agent.\n\n*No prompts yet.*\n', 'utf8');

  const ctx = path.join(root, 'CONTEXT.md');
  if (fs.existsSync(ctx)) {
    try { fs.unlinkSync(ctx); } catch {}
  }

  captureSnapshot(0);
  vscode.window.showInformationMessage('Tursiops: Commit detected — prompt memory, changes & snapshots reset for fresh session.');
}

export function watchGitReset(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }
  const workspaceCwd = folders[0].uri.fsPath;
  const gitDir       = path.join(workspaceCwd, '.git');

  if (!getSnapshot(0)) {
    captureSnapshot(0);
  }

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
    } catch {}
  };

  start();
  context.subscriptions.push({ dispose: () => fsWatcher?.close() });
}


export async function summarizeChangeFileOnDemand(
  changeIndex: number,
  geminiKey: string
): Promise<string> {
  const dir = changesDir();
  if (!dir) { return 'Workspace directory not found.'; }

  const filePath = path.join(dir, 'change_' + changeIndex + '.md');
  if (!fs.existsSync(filePath)) {
    return 'Change file for Prompt #' + changeIndex + ' does not exist.';
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const promptMatch = content.match(/^\*\*Prompt:\*\* (.+)$/m);
  const prompt = promptMatch ? promptMatch[1].trim() : 'Prompt #' + changeIndex;

  const diffMatch = content.match(/\`\`\`diff\n([\s\S]*?)\`\`\`/);
  const diff = diffMatch ? diffMatch[1].trim() : '';

  if (!diff || diff === 'No file changes detected.') {
    return 'No file modifications recorded for Prompt #' + changeIndex + '.';
  }

  if (!geminiKey) {
    return 'Gemini API key is missing. Please save your key in settings.';
  }

  const summary = await summariseDiff(diff, prompt, geminiKey);

  // Update change file so summary is stored permanently
  try {
    const updatedContent = content.replace(
      /## Gemini Summary\n([\s\S]*?)(?=\n## Modified Files|\n## Complete Changes Diff|\n## Raw Diff|$)/,
      '## Gemini Summary\n' + summary + '\n\n'
    );
    fs.writeFileSync(filePath, updatedContent, 'utf8');
  } catch {}

  return summary;
}
