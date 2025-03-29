import { SelectedTool } from 'apps/dialogue/src/chat/dialogue.chat.tools.dto';

export interface ToolTriggerEventDto
  extends SelectedTool<{
    [key: string]: string;
  }> {
  appId: string;
  sessionId: string;
  repositoryId: string;
  source?: 'message' | 'ui' | 'task' | 'agent';
}
