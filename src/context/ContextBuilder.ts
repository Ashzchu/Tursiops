import * as crypto from 'crypto';
import { ActiveFile } from './ActiveFileReader';
import { FileMemory, MemoryEvent } from '../memory/MemorySchema';
import { ContextPacket } from '../artifacts/ContextPacket';
import { hashContent } from '../utils/hashing';

const RECENT_EVENTS_LIMIT = 5;
const RELATED_FILES_TOKEN_BUDGET = 8000;

export function buildContextPacket(
  activeFile: ActiveFile,
  memory: FileMemory,
  relatedFiles: Array<{ path: string; content: string }>,
  userPrompt: string
): ContextPacket {
  const recentEvents: MemoryEvent[] = memory.events.slice(-RECENT_EVENTS_LIMIT);

  return {
    requestId: crypto.randomUUID(),
    fileId: memory.fileId,
    filePath: activeFile.relativePath,
    language: activeFile.languageId,
    userPrompt,
    currentFile: {
      content: activeFile.content,
      hash: hashContent(activeFile.content),
    },
    memory: {
      summary: memory.summary,
      constraints: memory.constraints,
      decisions: memory.decisions,
      knownFlaws: memory.knownFlaws,
      recentEvents,
    },
    relatedFiles,
    tokenBudget: RELATED_FILES_TOKEN_BUDGET,
  };
}
