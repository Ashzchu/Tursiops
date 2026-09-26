export const MEMORY_VERSION = 1;

export interface MemoryEvent {
  timestamp: string;        // ISO string
  type: 'summary' | 'change' | 'validation' | 'user' | 'compression';
  summary: string;
  detail?: string;
}

export interface FileMemory {
  fileId: string;
  filePath: string;
  language: string;
  currentHash: string;
  summary: string;
  constraints: string[];
  decisions: string[];
  knownFlaws: string[];
  events: MemoryEvent[];
}

export interface WorkspaceMemory {
  version: typeof MEMORY_VERSION;
  workspaceId: string;
  files: Record<string, FileMemory>;
}
