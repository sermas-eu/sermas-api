import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { SessionContext } from 'apps/session/src/session.context';
import { LLMChatArgs } from 'libs/llm/llm.provider.dto';
import {
  LLMCallResult,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { SelectedTool } from './dialogue.chat.tools.dto';

type AvatarSessionContext = {
  sessionContext?: SessionContext;
  provider?: string;
  model?: string;
};

type AvatarSystemChat = {
  system: {
    app: string;
    language: string;
    avatar: string;
    history: string;
    message: string;
    emotion?: string;
    tools?: string;
  };
};

type AvatarToolsChat = {
  tools?: AppToolsDTO[];
};

type AvatarTextChat = {
  chat?: {
    emotion?: string;
    knowledge: string;
    tasks: string;
    task?: string;
    field?: string;
  };
};

export type AvatarToolsRequest = AvatarSystemChat &
  AvatarToolsChat &
  AvatarSessionContext;

export type AvatarTextRequest = AvatarSystemChat &
  AvatarTextChat &
  AvatarSessionContext;

export type AvatarChatRequest = AvatarSystemChat &
  AvatarTextChat &
  AvatarToolsChat &
  LLMProviderConfig &
  AvatarSessionContext & {
    chatArgs?: Partial<LLMChatArgs>;
    toolsArgs?: Partial<LLMChatArgs>;
  };

export type LLMCombinedResult = LLMCallResult & {
  tools?: SelectedTool[];
};
