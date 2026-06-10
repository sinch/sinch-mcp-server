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

const SetWhatsAppChannelOnAppInput = {
  appId: ConversationAppId,
  senderId: z.string()
    .describe('WhatsApp sender ID.'),
  bearerToken: z.string()
    .describe('Bearer token for the WhatsApp channel.'),
  region: ConversationRegionOverride,
};

type SetWhatsAppChannelOnAppInputSchema = z.infer<z.ZodObject<typeof SetWhatsAppChannelOnAppInput>>;

const TOOL_KEY: ConversationToolKey = 'setWhatsAppChannelOnApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSetWhatsAppChannelOnApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Set (create or replace) the WhatsApp channel on a Conversation API app. Requires the WhatsApp sender ID and bearer token. For vague requests such as "add messaging", ask whether the user means SMS, RCS, or WhatsApp and collect the required credentials before calling a tool.',
      inputSchema: SetWhatsAppChannelOnAppInput,
    },
    setWhatsAppChannelOnAppHandler,
  );
};

export const setWhatsAppChannelOnAppHandler = async ({
  appId,
  senderId,
  bearerToken,
  region,
}: SetWhatsAppChannelOnAppInputSchema): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const credential = buildWhatsAppChannelCredential(senderId, bearerToken);
  return addChannelToApp(conversationService, usedRegion, appId, credential);
};
