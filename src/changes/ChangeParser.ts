import { AgentResponse } from '../ai/AiSchemas';

export interface ParsedChange {
  originalContent: string;
  proposedContent: string;
  summary: string;
  decisions: string[];
  warnings: string[];
}

export function parseChange(response: AgentResponse, originalContent: string): ParsedChange {
  return {
    originalContent,
    proposedContent: response.updatedFile,  // full new file content
    summary: response.summary,
    decisions: response.decisions,
    warnings: response.warnings,
  };
}
