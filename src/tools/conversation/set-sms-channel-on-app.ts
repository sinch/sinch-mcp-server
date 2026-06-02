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

const TOOL_KEY: ConversationToolKey = 'setSmsChannelOnApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSetSmsChannelOnApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Set (create or replace) the SMS channel on a Conversation API app. Requires the SMS service plan ID and API token. The app must be in the same region as the SMS service plan. For vague requests such as "add messaging", ask whether the user means SMS, RCS, or WhatsApp and collect the required credentials before calling a tool.',
    {
      appId: ConversationAppId,
      servicePlanId: z.string()
        .describe('Sinch SMS service plan ID.'),
      apiToken: z.string()
        .describe('Sinch API token for the SMS service plan.'),
      region: ConversationRegionOverride,
    },
    setSmsChannelOnAppHandler,
  );
};

export const setSmsChannelOnAppHandler = async ({
  appId,
  servicePlanId,
  apiToken,
  region,
}: {
  appId: string;
  servicePlanId: string;
  apiToken: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const credential = buildSmsChannelCredential(servicePlanId, apiToken);
  return addChannelToApp(conversationService, usedRegion, appId, credential);
};
