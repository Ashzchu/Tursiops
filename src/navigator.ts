import * as vscode from 'vscode';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Workspace inventory — scan all files (respects .gitignore exclusions)
// ---------------------------------------------------------------------------
export interface FileEntry {
  rel:  string;   // relative path  e.g. "src/utils/auth.ts"
  name: string;   // filename only  e.g. "auth.ts"
  ext:  string;   // extension      e.g. ".ts"
}

export async function buildInventory(): Promise<FileEntry[]> {
  // Find all files, exclude node_modules / .git / dist / build / out
  const uris = await vscode.workspace.findFiles(
    '**/*',
    '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,.tursiops/**}',
    5000,
  );

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  return uris.map(u => {
    const rel  = root ? path.relative(root, u.fsPath).replace(/\\/g, '/') : u.fsPath;
    const name = path.basename(u.fsPath);
    const ext  = path.extname(u.fsPath).toLowerCase();
    return { rel, name, ext };
  }).sort((a, b) => a.rel.localeCompare(b.rel));
}

// ---------------------------------------------------------------------------
// Gemini-powered search
// Given the user's natural language query and the file list,
// Gemini returns the best matching file paths.
// ---------------------------------------------------------------------------
export interface NavResult {
  path:   string;
  reason: string;
}

export async function searchWithGemini(
  query: string,
  inventory: FileEntry[],
  geminiKey: string,
): Promise<NavResult[]> {

  // Build a compact file list string (max 3000 files to stay within token limit)
  const fileList = inventory
    .slice(0, 3000)
    .map(f => f.rel)
    .join('\n');

  const prompt = `You are a code navigator assistant. Given a workspace file list and a user query, return the most relevant files.

User query: "${query}"

Workspace files:
${fileList}

Instructions:
- Return a JSON array of objects: [{"path":"<relative path>","reason":"<one short sentence why>"}]
- Return at most 5 results, ordered by relevance (most relevant first)
- Only include files that genuinely match the query
- If nothing matches, return []
- Return ONLY the JSON array, no markdown, no explanation`;

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) { throw new Error(`Gemini error: ${res.status}`); }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '[]';

  // Strip markdown code fences if Gemini wraps in ```json
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as NavResult[];
    // Validate shape and filter to files that actually exist in inventory
    const relSet = new Set(inventory.map(f => f.rel));
    return parsed
      .filter(r => r && typeof r.path === 'string')
      .map(r => ({ path: r.path, reason: r.reason ?? '' }))
      .filter(r => relSet.has(r.path))
      .slice(0, 5);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Open a file in the editor
// ---------------------------------------------------------------------------
export async function openFile(relPath: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }
  const abs = path.join(folders[0].uri.fsPath, relPath);
  const uri = vscode.Uri.file(abs);
  await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: false });
}
