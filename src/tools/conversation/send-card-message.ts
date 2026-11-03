import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildMessageBase, formatSendError } from './utils/send-message-builder';
import { choiceMessage } from './utils/choice-builder';
import { buildCard, cardDescription, cardMediaUrl, cardTitle } from './utils/card-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

export const SendCardMessageSchema = {
  recipient: Recipient,
  choiceContent: z.array(choiceMessage).max(10).optional().describe('The list of choices to send to the user'),
  title: cardTitle,
  description: cardDescription,
  mediaUrl: cardMediaUrl,
  channel: ConversationChannel,
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
};

type SendCardMessage = z.infer<z.ZodObject<typeof SendCardMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendCardMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendCardMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Send a card message to the user: a media with a title, an optional description and an optional list of choices. Each choice can be a call message (phone number + title to display next to it), a location message (latitude / longitude + title to display next to it), a text message or a URL message (the URL to click on + title to display next to it). The contact can be a phone number in E.164 format, or the identifier for the specified channel. To send choices without a media, use the send-choice-message tool instead.',
      inputSchema: SendCardMessageSchema,
    },
    sendCardMessageHandler,
  );
};

export const sendCardMessageHandler = async ({
  recipient,
  channel,
  choiceContent,
  title,
  description,
  mediaUrl,
  appId,
  sender,
  region,
}: SendCardMessage): Promise<IPromptResponse> => {
  const maybeAppId = getConversationAppId(appId);
  if (isPromptResponse(maybeAppId)) {
    return maybeAppId.promptResponse;
  }
  const conversationAppId = maybeAppId;

  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const card = await buildCard({ title, description, mediaUrl, choiceContent });

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
    const response = await conversationService.messages.sendCardMessage({
      sendMessageRequestBody: {
        ...requestBase,
        message: {
          card_message: card,
        },
      },
    });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        message_id: response.message_id,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: formatSendError(error, usedRegion),
      }),
    ).promptResponse;
  }
};
