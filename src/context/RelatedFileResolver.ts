import * as path from 'path';
import { readFile } from 'fs/promises';
import { filterSecretFiles } from './SecretFilter';

// Supported source extensions to resolve
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

// Regex to extract import paths
const IMPORT_REGEX = /(?:import|from)\s+['"]([^'"]+)['"]/g;
const REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export async function resolveRelatedFiles(
  activeFilePath: string,  // absolute path
  workspaceRoot: string,
  maxFiles = 5
): Promise<string[]> {
  let content: string;
  try {
    content = await readFile(activeFilePath, 'utf8');
  } catch {
    return [];
  }

  const importPaths = new Set<string>();

  // Collect all import/require paths
  for (const regex of [IMPORT_REGEX, REQUIRE_REGEX]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      importPaths.add(match[1]);
    }
  }

  const resolved: string[] = [];

  for (const importPath of importPaths) {
    // Skip node_modules, URLs, and absolute paths
    if (!importPath.startsWith('.')) { continue; }
    if (importPath.startsWith('//') || importPath.startsWith('http')) { continue; }

    const dir = path.dirname(activeFilePath);
    const base = path.resolve(dir, importPath);

    // Try with each source extension
    const candidates: string[] = [base];
    for (const ext of SOURCE_EXTENSIONS) {
      candidates.push(base + ext);
      candidates.push(path.join(base, 'index' + ext));
    }

    for (const candidate of candidates) {
      try {
        await readFile(candidate, 'utf8');
        resolved.push(candidate);
        break;
      } catch {
        continue;
      }
    }

    if (resolved.length >= maxFiles * 2) { break; } // early cut before filtering
  }

  // Filter secrets and node_modules, cap at maxFiles
  const safe = filterSecretFiles(resolved);
  return safe.slice(0, maxFiles);
}
