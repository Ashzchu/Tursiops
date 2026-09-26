import { FileMemory } from './MemorySchema';
import { AiProvider } from '../ai/AiProvider';
import { MemoryStore } from './MemoryStore';

const COMPRESSION_THRESHOLD = 10; // compress when events exceed this count

export async function compressMemory(
  store: MemoryStore,
  fileId: string,
  provider: AiProvider
): Promise<void> {
  const memory = store.get(fileId);
  if (!memory || memory.events.length <= COMPRESSION_THRESHOLD) {
    return;
  }
  const compressed = await provider.compress(memory);
  store.update(fileId, {
    summary: compressed.summary,
    decisions: compressed.decisions,
    constraints: compressed.constraints,
    knownFlaws: compressed.knownFlaws,
    events: compressed.events,
  });
  await store.save();
}
