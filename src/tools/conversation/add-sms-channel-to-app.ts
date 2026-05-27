import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildSmsChannelCredential } from './utils/build-channel-credential';
import { addChannelToApp } from './utils/app-tools-helper';
import { IPromptResponse, Tags } from '../../types';
import {
  ConversationAppId,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'addSmsChannelToApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAddSmsChannelToApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Add or update the SMS channel on a Conversation API app. Requires the Sinch SMS service plan ID and API token. The app must be in the same region as the SMS service plan.',
    {
      appId: ConversationAppId,
      servicePlanId: z.string()
        .describe('(Required) Sinch SMS service plan ID (static bearer claimed_identity).'),
      apiToken: z.string()
        .describe('(Required) Sinch API token for the SMS service plan (static bearer token).'),
      region: ConversationRegionOverride,
      callbackSecret: z.string().optional()
        .describe('(Optional) Secret used to verify channel callbacks when supported.'),
    },
    addSmsChannelToAppHandler,
  );
};

export const addSmsChannelToAppHandler = async ({
  appId,
  servicePlanId,
  apiToken,
  region,
  callbackSecret,
}: {
  appId: string;
  servicePlanId: string;
  apiToken: string;
  region?: string;
  callbackSecret?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const credential = buildSmsChannelCredential(servicePlanId, apiToken, { callbackSecret });
  return addChannelToApp(conversationService, usedRegion, appId, credential);
};
