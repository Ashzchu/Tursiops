import { AgentResponse } from '../ai/AiSchemas';
import * as path from 'path';

export function validateChange(response: AgentResponse, activeFilePath: string): void {
  if (!response.updatedFile || response.updatedFile.trim().length === 0) {
    throw new Error('Proposed change is empty.');
  }
  // The response.updatedFile is the full new content — not a path.
  // The activeFilePath is the absolute path of the file being edited.
  // We validate that the response is not suspiciously huge.
  // (Path validation is done by the orchestrator which controls which file is in scope.)
}

export function validateChangeSize(originalContent: string, proposedContent: string): void {
  const ratio = proposedContent.length / Math.max(originalContent.length, 1);
  if (ratio > 10) {
    throw new Error(`Proposed change is ${ratio.toFixed(1)}x the original size — rejecting as suspicious.`);
  }
}
