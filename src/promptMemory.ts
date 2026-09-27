import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
function tursiopsDir(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) { return null; }
  return path.join(folders[0].uri.fsPath, '.tursiops');
}

function memoryDir(): string | null {
  const root = tursiopsDir();
  if (!root) { return null; }
  const dir = path.join(root, 'memory');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  return dir;
}

function ensureDir(): string | null {
  const dir = tursiopsDir();
  if (!dir) { return null; }
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  return dir;
}

export function rememberFile(): string | null {
  const dir = memoryDir();
  return dir ? path.join(dir, 'remember.md') : null;
}

export function forgetFile(): string | null {
  const dir = memoryDir();
  return dir ? path.join(dir, 'forget.md') : null;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function gitLog(cwd: string): string {
  try {
    return cp.execSync('git log --oneline -1', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'no-commit';
  }
}

function currentBranch(cwd: string): string {
  try {
    return cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Gemini refinement
// ---------------------------------------------------------------------------
export async function refinePrompt(raw: string, geminiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const body = {
    contents: [{
      parts: [{
        text: `You are an expert prompt engineer. Your task is to refine the following user prompt into a concise, clear, and highly effective version that preserves 100% of the original intent. Return ONLY the refined prompt text — no explanations, no preamble, no quotes.\n\nOriginal prompt:\n${raw}`,
      }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) { return raw; } // fallback to original on error
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? raw;
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------
export interface PromptEntry {
  index: number;
  timestamp: string;
  gitCommit: string;
  branch: string;
  raw: string;
  refined: string;
}

function parseEntries(filepath: string): PromptEntry[] {
  if (!fs.existsSync(filepath)) { return []; }
  const content = fs.readFileSync(filepath, 'utf8');
  const entries: PromptEntry[] = [];

  // Split on entry separators
  const blocks = content.split(/^---$/m).filter(b => b.trim());
  for (const block of blocks) {
    const idx       = block.match(/^## Prompt #(\d+)/m)?.[1];
    const ts        = block.match(/^\*\*Time:\*\* (.+)$/m)?.[1];
    const commit    = block.match(/^\*\*Commit:\*\* (.+)$/m)?.[1];
    const branch    = block.match(/^\*\*Branch:\*\* (.+)$/m)?.[1];
    const rawMatch  = block.match(/### Original\n([\s\S]*?)(?=###|$)/);
    const refMatch  = block.match(/### Refined\n([\s\S]*?)(?=---|$)/);

    if (idx && ts) {
      entries.push({
        index:     parseInt(idx),
        timestamp: ts.trim(),
        gitCommit: commit?.trim() ?? '',
        branch:    branch?.trim() ?? '',
        raw:       rawMatch?.[1]?.trim() ?? '',
        refined:   refMatch?.[1]?.trim() ?? '',
      });
    }
  }
  return entries;
}

function renderFile(entries: PromptEntry[], mode: 'remember' | 'forget'): string {
  const title = mode === 'remember' ? '# 🧠 Prompt Memory — Remember' : '# 🗑️ Prompt Memory — Forget';
  const sub   = mode === 'remember'
    ? '> Prompts the AI agent SHOULD remember and apply.\n> **Auto-read by Tursiops on every agent activation.**'
    : '> Prompts the AI agent SHOULD ignore or move away from.\n> **Auto-read by Tursiops on every agent activation.**';

  if (entries.length === 0) {
    return `${title}\n\n${sub}\n\n*No prompts recorded yet.*\n`;
  }

  const blocks = entries.map(e => `---\n\n## Prompt #${e.index}\n\n**Time:** ${e.timestamp}  \n**Commit:** ${e.gitCommit}  \n**Branch:** ${e.branch}\n\n### Original\n${e.raw}\n\n### Refined\n${e.refined}\n`);
  return `${title}\n\n${sub}\n\n${blocks.join('\n')}`;
}

export async function addPrompt(
  mode: 'remember' | 'forget',
  rawPrompt: string,
  geminiKey: string,
): Promise<PromptEntry> {
  const filepath = mode === 'remember' ? rememberFile() : forgetFile();
  if (!filepath) { throw new Error('No workspace open'); }

  const existing = parseEntries(filepath);
  const folders  = vscode.workspace.workspaceFolders!;
  const cwd      = folders[0].uri.fsPath;

  const refined = await refinePrompt(rawPrompt, geminiKey);
  const entry: PromptEntry = {
    index:     existing.length + 1,
    timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
    gitCommit: gitLog(cwd),
    branch:    currentBranch(cwd),
    raw:       rawPrompt.trim(),
    refined,
  };

  existing.push(entry);
  fs.writeFileSync(filepath, renderFile(existing, mode), 'utf8');
  return entry;
}

export function loadEntries(mode: 'remember' | 'forget'): PromptEntry[] {
  const filepath = mode === 'remember' ? rememberFile() : forgetFile();
  if (!filepath) { return []; }
  return parseEntries(filepath);
}

export function updateEntry(
  mode: 'remember' | 'forget',
  index: number,
  newRefined: string,
): void {
  const filepath = mode === 'remember' ? rememberFile() : forgetFile();
  if (!filepath) { return; }
  const entries = parseEntries(filepath);
  const entry = entries.find(e => e.index === index);
  if (entry) {
    entry.refined = newRefined.trim();
    fs.writeFileSync(filepath, renderFile(entries, mode), 'utf8');
  }
}

// ---------------------------------------------------------------------------
// Git watcher — delete md files on commit, create fresh ones
// Uses native fs.watch because VS Code's watcher excludes .git/
// ---------------------------------------------------------------------------
export function watchGit(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }
  const cwd    = folders[0].uri.fsPath;
  const gitDir = path.join(cwd, '.git');
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
        resetAfterCommit();
      });
      fsWatcher.on('error', () => { fsWatcher?.close(); setTimeout(start, 3000); });
    } catch { /* no git repo yet — silently skip */ }
  };

  start();
  context.subscriptions.push({ dispose: () => fsWatcher?.close() });
}

function resetAfterCommit(): void {
  const root = tursiopsDir();
  if (!root || !fs.existsSync(root)) { return; }

  // Delete old memory files — they're already saved in the commit, nothing is lost
  const memDir = path.join(root, 'memory');
  for (const name of ['remember.md', 'forget.md']) {
    const f = path.join(memDir, name);
    if (fs.existsSync(f)) { fs.unlinkSync(f); }
  }
  const ctx = path.join(root, 'CONTEXT.md');
  if (fs.existsSync(ctx)) { fs.unlinkSync(ctx); }

  // Create fresh empty files for the new session
  if (!fs.existsSync(memDir)) { fs.mkdirSync(memDir, { recursive: true }); }
  fs.writeFileSync(path.join(memDir, 'remember.md'), renderFile([], 'remember'), 'utf8');
  fs.writeFileSync(path.join(memDir, 'forget.md'),   renderFile([], 'forget'),   'utf8');

  vscode.window.showInformationMessage('Tursiops: New commit detected — prompt memory reset for fresh session.');
}

// ---------------------------------------------------------------------------
// Force agent to read files — writes a .tursiops/CONTEXT.md that Bob/Copilot
// picks up via workspace rules (user adds .tursiops/*.md to their agent context)
// ---------------------------------------------------------------------------
export function generateContextSummary(): void {
  const dir = tursiopsDir();
  if (!dir) { return; }

  const memDir  = path.join(dir, 'memory');
  const remPath = path.join(memDir, 'remember.md');
  const frgPath = path.join(memDir, 'forget.md');

  const remEntries = fs.existsSync(remPath) ? parseEntries(remPath) : [];
  const frgEntries = fs.existsSync(frgPath) ? parseEntries(frgPath) : [];

  const remRefined = remEntries.map(e => `- ${e.refined}`).join('\n') || '- None';
  const frgRefined = frgEntries.map(e => `- ${e.refined}`).join('\n') || '- None';

  const summary = `# Tursiops Agent Context
> Auto-generated. Do not edit manually. Re-generated after every prompt.
> **AI Agent: Read this file before responding to any request.**

## ✅ Remember (apply these)
${remRefined}

## ❌ Forget (avoid these)
${frgRefined}

*Last updated: ${new Date().toLocaleString('en-GB', { hour12: false })}*
`;

  ensureDir();
  fs.writeFileSync(path.join(dir!, 'CONTEXT.md'), summary, 'utf8');
}
