import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildWhatsAppChannelCredential } from './utils/build-channel-credential';
import { addChannelToApp } from './utils/app-tools-helper';
import { IPromptResponse, Tags } from '../../types';
import {
  ConversationAppId,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'addWhatsAppChannelToApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAddWhatsAppChannelToApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Add or update the WhatsApp channel on a Conversation API app. Requires the WhatsApp sender ID and bearer token for the static bearer credential.',
    {
      appId: ConversationAppId,
      senderId: z.string()
        .describe('(Required) WhatsApp sender ID (static bearer claimed_identity).'),
      bearerToken: z.string()
        .describe('(Required) Bearer token for the WhatsApp channel integration (static bearer token).'),
      region: ConversationRegionOverride,
      callbackSecret: z.string().optional()
        .describe('(Optional) Secret used to verify channel callbacks when supported.'),
    },
    addWhatsAppChannelToAppHandler,
  );
};

export const addWhatsAppChannelToAppHandler = async ({
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

  const credential = buildWhatsAppChannelCredential(senderId, bearerToken, { callbackSecret });
  return addChannelToApp(conversationService, usedRegion, appId, credential);
};
