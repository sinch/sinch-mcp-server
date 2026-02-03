import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationAppId,
  getConversationClient,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildMessageBase } from './utils/send-message-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  MessageSenderNumberOverride,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'sendWhatsAppTemplateMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendWhatsAppTemplateMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a template message to a contact (phone number in E.164 format) on the WhatsApp channel.',
    {
      recipient: Recipient,
      templateName: z.string()
        .describe('The name of the template to use for sending the message on WhatsApp specifically.'),
      templateLanguage: z.string()
        .describe('The language to use for the WhatsApp template (BCP-47).'),
      parameters: z.record(z.string(), z.string()).optional()
        .describe('The parameters to use for the template. This is a key-value map where the key is the parameter name and the value is the parameter value. Look carefully in the prompt to find which parameters are expected by the template.'),
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
      metadata: z.string().optional().describe('Custom data to send along with the message (e.g. correlation IDs, appointment IDs, etc.)')
    },
    sendTemplateMessageHandler
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
}: {
  recipient: string;
  templateName: string;
  templateLanguage: string;
  parameters?: Record<string, string>;
  appId?: string;
  sender?: string;
  metadata?: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeAppId = getConversationAppId(appId);
  if (isPromptResponse(maybeAppId)) {
    return maybeAppId.promptResponse;
  }
  const conversationAppId = maybeAppId;

  const maybeClient = getConversationClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const sinchClient = maybeClient;
  const usedRegion = setConversationRegion(region, sinchClient);

  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, ['WHATSAPP'], sender);
  const whatsappMessage: Conversation.TemplateMessageItem = {
    channel_template: {
      WHATSAPP: {
        template_id: templateName,
        language_code: templateLanguage,
        version: '',
        parameters: {
          ...parameters
        }
      }
    }
  };
  const request: Conversation.SendTemplateMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        template_message: {
          ...whatsappMessage
        }
      },
      message_metadata: metadata
    }
  };

  try {
    const response = await sinchClient.conversation.messages.sendTemplateMessage(request);
    return new PromptResponse(JSON.stringify({
      success: true,
      message_id: response.message_id
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) + `. Are you sure you are using the right region to send your message? The current region is ${usedRegion}.`
    })).promptResponse;
  }
};
