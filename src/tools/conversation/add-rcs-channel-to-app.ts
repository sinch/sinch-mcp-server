import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildRcsChannelCredential } from './utils/build-channel-credential';
import { addChannelToApp } from './utils/app-tools-helper';
import { IPromptResponse, Tags } from '../../types';
import {
  ConversationAppId,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'addRcsChannelToApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAddRcsChannelToApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Add or update the RCS channel on a Conversation API app. Requires the RCS sender identifier and bearer token for the static bearer credential.',
    {
      appId: ConversationAppId,
      senderId: z.string()
        .describe('(Required) RCS sender identifier (static bearer claimed_identity).'),
      bearerToken: z.string()
        .describe('(Required) Bearer token for the RCS channel integration (static bearer token).'),
      region: ConversationRegionOverride,
      callbackSecret: z.string().optional()
        .describe('(Optional) Secret used to verify channel callbacks when supported.'),
    },
    addRcsChannelToAppHandler,
  );
};

export const addRcsChannelToAppHandler = async ({
  appId,
  senderId,
  bearerToken,
  region,
  callbackSecret,
}: {
  appId: string;
  senderId: string;
  bearerToken: string;
  region?: string;
  callbackSecret?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const credential = buildRcsChannelCredential(senderId, bearerToken, { callbackSecret });
  return addChannelToApp(conversationService, usedRegion, appId, credential);
};
