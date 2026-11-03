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
import { buildChoices, choiceMessage } from './utils/choice-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const SendChoiceMessageSchema = {
  recipient: Recipient,
  choiceContent: z.array(choiceMessage).max(10).optional().describe('The list of choices to send to the user'),
  text: z.string().describe('The text to be sent along the choice array'),
  channel: ConversationChannel,
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
};

type SendChoiceMessage = z.infer<z.ZodObject<typeof SendChoiceMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendChoiceMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendChoiceMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Send a choice message to the user. The choice message can contain up to 3 choices if not text or up to 10 message if text only. Each choice can be a call message (phone number + title to display next to it), a location message (latitude / longitude + title to display next to it), a text message or a URL message (the URL to click on + title to display next to it). The contact can be a phone number in E.164 format, or the identifier for the specified channel. To send the choices along a media, use the send-card-message tool instead.',
      inputSchema: SendChoiceMessageSchema,
    },
    sendChoiceMessageHandler,
  );
};

export const sendChoiceMessageHandler = async ({
  recipient,
  channel,
  choiceContent,
  text,
  appId,
  sender,
  region,
}: SendChoiceMessage): Promise<IPromptResponse> => {
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

  const choices = await buildChoices(choiceContent);

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
    const response = await conversationService.messages.sendChoiceMessage({
      sendMessageRequestBody: {
        ...requestBase,
        message: {
          choice_message: {
            choices,
            text_message: {
              text,
            },
          },
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
