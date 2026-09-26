import { MemoryEvent } from '../memory/MemorySchema';

export interface ContextPacket {
  requestId: string;
  fileId: string;
  filePath: string;
  language: string;
  userPrompt: string;
  currentFile: {
    content: string;
    hash: string;
  };
  memory: {
    summary: string;
    constraints: string[];
    decisions: string[];
    knownFlaws: string[];
    recentEvents: MemoryEvent[];
  };
  relatedFiles: Array<{
    path: string;
    content: string;
  }>;
  tokenBudget: number;
}
