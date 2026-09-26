import { FileMemory } from '../memory/MemorySchema';

export interface AiProvider {
  summarize(content: string, language: string): Promise<string>;
  compress(memory: FileMemory): Promise<FileMemory>;
}
