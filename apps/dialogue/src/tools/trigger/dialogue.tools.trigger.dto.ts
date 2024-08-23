import { SelectedTool } from 'libs/llm/tools/tool.dto';

export interface ToolTriggerEventDto
  extends SelectedTool<{
    [key: string]: string;
  }> {
  appId: string;
  sessionId: string;
  repositoryId: string;
  source?: 'message' | 'ui' | 'task' | 'agent';
}
