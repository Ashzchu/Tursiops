import * as vscode from 'vscode';
import { WorkflowState } from '../orchestrator/WorkflowState';
import { MemoryStore } from '../memory/MemoryStore';
import { getFileId } from '../memory/FileIdentity';
import { getWorkspaceRoot } from '../utils/paths';
import { log, logError } from '../utils/logging';
import { parseChange } from '../changes/ChangeParser';
import { showDiff } from '../changes/DiffPreview';
import { applyChange } from '../changes/WorkspaceEditor';
import { MemoryEvent } from '../memory/MemorySchema';
import * as vscodeApi from 'vscode';

export function registerReviewChange(
  context: vscode.ExtensionContext,
  workflowState: WorkflowState,
  memoryStore: MemoryStore
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.reviewChange', async () => {
      if (!workflowState.pendingResponse || !workflowState.pendingFilePath || !workflowState.pendingOriginalContent) {
        vscode.window.showInformationMessage('Tursiops: No pending change to review.');
        return;
      }

      const { pendingResponse, pendingFilePath, pendingOriginalContent } = workflowState;
      const parsed = parseChange(pendingResponse, pendingOriginalContent);
      const decision = await showDiff(parsed.originalContent, parsed.proposedContent, pendingFilePath);

      if (decision === 'rejected') {
        vscode.window.showInformationMessage('Tursiops: Change rejected — file unchanged.');
        workflowState.clear();
        return;
      }

      const uri = vscode.Uri.file(pendingFilePath);
      try {
        await applyChange(uri, parsed.proposedContent);
      } catch (err) {
        logError('Failed to apply change', err);
        vscode.window.showErrorMessage(`Tursiops: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      // Record in memory
      const workspaceRoot = getWorkspaceRoot();
      if (workspaceRoot) {
        const relativePath = vscodeApi.workspace.asRelativePath(uri);
        const fileId = getFileId(relativePath);
        const event: MemoryEvent = {
          timestamp: new Date().toISOString(),
          type: 'change',
          summary: parsed.summary,
        };
        memoryStore.appendEvent(fileId, event);
        await memoryStore.save();
      }

      workflowState.clear();
      log(`Change applied via review to ${pendingFilePath}`);
      vscode.window.showInformationMessage(`Tursiops: Change applied — ${parsed.summary}`);
    })
  );
}
