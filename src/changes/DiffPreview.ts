import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export async function showDiff(
  original: string,
  proposed: string,
  filePath: string
): Promise<'approved' | 'rejected'> {
  const id = crypto.randomUUID().slice(0, 8);
  const tmpDir = os.tmpdir();
  const origPath = path.join(tmpDir, `tursiops-orig-${id}.tmp`);
  const propPath = path.join(tmpDir, `tursiops-prop-${id}.tmp`);

  fs.writeFileSync(origPath, original, 'utf8');
  fs.writeFileSync(propPath, proposed, 'utf8');

  const origUri = vscode.Uri.file(origPath);
  const propUri = vscode.Uri.file(propPath);
  const title = `Tursiops: ${path.basename(filePath)} (proposed change)`;

  await vscode.commands.executeCommand('vscode.diff', origUri, propUri, title);

  const choice = await vscode.window.showInformationMessage(
    `Tursiops proposes a change to ${path.basename(filePath)}. Apply it?`,
    { modal: false },
    '✅ Approve',
    '❌ Reject'
  );

  // Clean up temp files
  try { fs.unlinkSync(origPath); } catch { /* ignore */ }
  try { fs.unlinkSync(propPath); } catch { /* ignore */ }

  return choice === '✅ Approve' ? 'approved' : 'rejected';
}
