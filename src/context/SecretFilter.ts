import * as path from 'path';

// Exact filename matches (basename)
const SECRET_EXACT: ReadonlySet<string> = new Set([
  '.env', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa',
  'credentials.json', '.netrc', '.npmrc', '.pypirc',
]);

// Extension matches (endsWith)
const SECRET_EXTENSIONS: readonly string[] = [
  '.env', '.pem', '.key', '.p12', '.pfx', '.secret',
  '.cert', '.crt', '.jks', '.keystore',
];

// Prefix matches for known secret files
const SECRET_PREFIXES: readonly string[] = [
  'id_rsa', 'id_ed25519', 'id_ecdsa',
];

export function isSecretFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();

  // Exact match
  if (SECRET_EXACT.has(base)) { return true; }

  // Extension match
  if (SECRET_EXTENSIONS.some(ext => base.endsWith(ext))) { return true; }

  // Prefix match
  if (SECRET_PREFIXES.some(prefix => base.startsWith(prefix))) { return true; }

  // Pattern: any .env.* variant (e.g. .env.local, .env.production)
  if (base.startsWith('.env')) { return true; }

  return false;
}

export function filterSecretFiles(filePaths: string[]): string[] {
  return filePaths.filter(p => {
    if (isSecretFile(p)) { return false; }
    // Also exclude node_modules
    const normalized = p.replace(/\\/g, '/');
    if (normalized.includes('/node_modules/')) { return false; }
    return true;
  });
}
