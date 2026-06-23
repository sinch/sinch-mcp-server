import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/conversation';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildMessageBase, formatSendError } from './utils/send-message-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';

const SendTemplateMessageSchema = {
  recipient: Recipient,
  templateId: z.string().describe('The ID (ULID format) of the omni-template template to use for sending the message.'),
  language: z
    .string()
    .optional()
    .describe(
      'The language to use for the omni-template (BCP-47). If not set, the default language code will be used.',
    ),
  parameters: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'The parameters to use for the template. This is a key-value map where the key is the parameter name and the value is the parameter value. Look carefully in the prompt to find which parameters are expected by the template.',
    ),
  channel: ConversationChannel,
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
};

type SendTemplateMessage = z.infer<z.ZodObject<typeof SendTemplateMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendTemplateMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendTemplateMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Send a template message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
      inputSchema: SendTemplateMessageSchema,
    },
    sendTemplateMessageHandler,
  );
};

export const sendTemplateMessageHandler = async ({
  recipient,
  channel,
  templateId,
  language,
  parameters,
  appId,
  sender,
  region,
}: SendTemplateMessage): Promise<IPromptResponse> => {
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

  const omniChannelMessage: Conversation.TemplateMessageItem = {
    omni_template: {
      template_id: templateId,
      version: 'latest',
      parameters: {
        ...parameters,
      },
    },
  };
  if (language) {
    omniChannelMessage.omni_template!.language_code = language;
  }

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
    const request: Conversation.SendTemplateMessageRequestData<Conversation.IdentifiedBy> = {
      sendMessageRequestBody: {
        ...requestBase,
        message: {
          template_message: {
            ...omniChannelMessage,
          },
        },
      },
    };
    const response = await conversationService.messages.sendTemplateMessage(request);
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
