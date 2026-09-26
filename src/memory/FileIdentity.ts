import * as crypto from 'crypto';

export function getFileId(workspaceRelativePath: string): string {
  return crypto.createHash('sha256').update(workspaceRelativePath, 'utf8').digest('hex');
}
