import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
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
  MessageSenderNumberOverride,
  ConversationRegionOverride,
} from './prompt-schemas';

const SendWhatsAppTemplateMessageSchema = {
  recipient: Recipient,
  templateName: z
    .string()
    .describe('The name of the template to use for sending the message on WhatsApp specifically.'),
  templateLanguage: z.string().describe('The language to use for the WhatsApp template (BCP-47).'),
  parameters: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Template variable values, keyed using WhatsApp's structured parameter format: " +
        '<component>[<index>]<subtype>[<paramIndex>]<field>, e.g. "body[1]text" or "button[0]url[1]text". ' +
        'component is header, body, button, or carousel; index is 0-based and only used for carousel cards ' +
        'and buttons (omit it for header/body); paramIndex is 1-based. Never use bare keys like "1" or ' +
        'dotted keys like "body.1" — WhatsApp does not recognize them and the send will silently fail. Examples: ' +
        '"body[1]text" for a body variable; "header[1]text" for a text header variable; ' +
        '"header[1]image.link" / "header[1]video.link" / "header[1]document.link" (+ optional ' +
        '"header[1]document.filename") for a media header; "header[1]location.latitude" and ' +
        '"header[1]location.longitude" (+ optional "header[1]location.name" / "header[1]location.address") ' +
        'for a location header; "button[0]quick_reply[1]payload", "button[0]url[1]text", ' +
        '"button[0]copy_code[1]coupon_code", "button[0]flow[1]action.type" for interactive buttons; ' +
        '"carousel[0]header[1]image.link" and "carousel[0]body[1]text" for carousel card content.',
    ),
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
  metadata: z
    .string()
    .optional()
    .describe('Custom data to send along with the message (e.g. correlation IDs, appointment IDs, etc.)'),
};

type SendWhatsAppTemplateMessage = z.infer<z.ZodObject<typeof SendWhatsAppTemplateMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendWhatsAppTemplateMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendWhatsAppTemplateMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Send a WhatsApp-native template message (referred by template name) to a contact (phone number in E.164 format) on the WhatsApp channel. For omni-channel templates use send-template-message instead.',
      inputSchema: SendWhatsAppTemplateMessageSchema,
    },
    sendTemplateMessageHandler,
  );
};

export const sendTemplateMessageHandler = async ({
  recipient,
  templateName,
  templateLanguage,
  parameters,
  appId,
  sender,
  region,
  metadata,
}: SendWhatsAppTemplateMessage): Promise<IPromptResponse> => {
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

  const whatsappMessage: Conversation.TemplateMessageItem = {
    channel_template: {
      WHATSAPP: {
        template_id: templateName,
        language_code: templateLanguage,
        version: '',
        parameters: {
          ...parameters,
        },
      },
    },
  };

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, ['WHATSAPP'], sender);
    const request: Conversation.SendTemplateMessageRequestData<Conversation.IdentifiedBy> = {
      sendMessageRequestBody: {
        ...requestBase,
        message: {
          template_message: {
            ...whatsappMessage,
          },
        },
        message_metadata: metadata,
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
