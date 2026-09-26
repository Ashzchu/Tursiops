import { MemoryStore } from './MemoryStore';
import { MemoryEvent } from './MemorySchema';
import { hashContent } from '../utils/hashing';

export async function updateFileMemory(
  store: MemoryStore,
  fileId: string,
  newContent: string,
  _language: string
): Promise<void> {
  const newHash = hashContent(newContent);
  const existing = store.get(fileId);
  if (existing && existing.currentHash !== newHash) {
    const event: MemoryEvent = {
      timestamp: new Date().toISOString(),
      type: 'summary',
      summary: 'File content changed',
    };
    store.appendEvent(fileId, event);
    store.update(fileId, { currentHash: newHash });
    await store.save();
  }
}
