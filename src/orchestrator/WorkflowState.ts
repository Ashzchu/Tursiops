import { AgentResponse } from '../ai/AiSchemas';

export class WorkflowState {
  pendingResponse: AgentResponse | undefined = undefined;
  pendingFilePath: string | undefined = undefined;
  pendingOriginalContent: string | undefined = undefined;

  clear(): void {
    this.pendingResponse = undefined;
    this.pendingFilePath = undefined;
    this.pendingOriginalContent = undefined;
  }
}
