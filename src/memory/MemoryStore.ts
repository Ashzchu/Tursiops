import { readFile, writeFile, rename } from 'fs/promises';
import * as crypto from 'crypto';
import { FileMemory, MemoryEvent, WorkspaceMemory } from './MemorySchema';
import { getMemoryFilePath } from '../utils/paths';

export { FileMemory, MemoryEvent, WorkspaceMemory };

export class MemoryStore {
  private memory: WorkspaceMemory = {
    version: 1,
    workspaceId: '',
    files: {},
  };

  constructor(private readonly workspaceRoot: string) {}

  async load(): Promise<void> {
    const memoryPath = getMemoryFilePath(this.workspaceRoot);
    try {
      const raw = await readFile(memoryPath, 'utf8');
      this.memory = JSON.parse(raw) as WorkspaceMemory;
    } catch (err: unknown) {
      const isEnoent =
        typeof err === 'object' &&
        err !== null &&
        (err as NodeJS.ErrnoException).code === 'ENOENT';
      // Reinitialise on missing file or bad JSON
      this.memory = {
        version: 1,
        workspaceId: crypto.randomUUID(),
        files: {},
      };
      if (!isEnoent) {
        // JSON parse error or other — already reinitialised above
      }
    }
  }

  get(fileId: string): FileMemory | undefined {
    return this.memory.files[fileId];
  }

  getOrCreate(fileId: string, filePath: string, language: string): FileMemory {
    if (!this.memory.files[fileId]) {
      this.memory.files[fileId] = {
        fileId,
        filePath,
        language,
        currentHash: '',
        summary: '',
        constraints: [],
        decisions: [],
        knownFlaws: [],
        events: [],
      };
    }
    return this.memory.files[fileId];
  }

  update(fileId: string, delta: Partial<FileMemory>): void {
    if (this.memory.files[fileId]) {
      this.memory.files[fileId] = { ...this.memory.files[fileId], ...delta };
    }
  }

  appendEvent(fileId: string, event: MemoryEvent): void {
    if (this.memory.files[fileId]) {
      this.memory.files[fileId].events.push(event);
    }
  }

  remove(fileId: string): void {
    delete this.memory.files[fileId];
  }

  async save(): Promise<void> {
    const memoryPath = getMemoryFilePath(this.workspaceRoot);
    const tmpPath = memoryPath + '.tmp';
    const json = JSON.stringify(this.memory, null, 2);
    await writeFile(tmpPath, json, 'utf8');
    await rename(tmpPath, memoryPath);
  }
}
