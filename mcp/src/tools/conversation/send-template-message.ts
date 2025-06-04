import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse } from '../../utils';
import { getConversationAppId, getConversationRegion, getConversationService } from './utils/conversation-service-helper';
import { buildMessageBase } from './utils/send-message-builder';
import { Recipient, ConversationAppIdOverride, ConversationChannel, ConversationRegionOverride, MessageSenderNumberOverride } from './prompt-schemas';

export const registerSendTemplateMessage = (server: McpServer, tags: Tags[]) => {
  if (!tags.includes('all') && !tags.includes('conversation') && !tags.includes('notification')) {
    return;
  }

  server.tool(
    'send-template-message',
    'Send a template message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      templateId: z.string().optional()
        .describe('The ID (ULID format) of the omni-template template to use for sending the message.'),
      language: z.string().optional()
        .describe('The language to use for the omni-template (BCP-47). If not set, the default language code will be used.'),
      whatsAppTemplateName: z.string().optional()
        .describe('The name of the template to use for sending the message on WhatsApp specifically. At least one of templateId or templateName should be provided. If this is the template name, the message will be sent as a WhatsApp message, otherwise, it will be considered as an omni-channel message.'),
      whatsAppTemplateLanguage: z.string().optional()
        .describe('The language to use for the WhatsApp template (BCP-47). It is mandatory is the templateName is provided.'),
      parameters: z.record(z.string(), z.string()).optional()
        .describe('The parameters to use for the template. This is a key-value map where the key is the parameter name and the value is the parameter value.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride
    },
    sendTemplateMessageHandler
  );
};

export const sendTemplateMessageHandler = async ({
  recipient,
  channel,
  templateId,
  language,
  whatsAppTemplateName,
  whatsAppTemplateLanguage,
  parameters,
  appId,
  sender,
  region
}: {
  recipient: string;
  channel: string | string[];
  templateId?: string;
  language?: string;
  whatsAppTemplateName?: string;
  whatsAppTemplateLanguage?: string;
  parameters?: Record<string, string>;
  appId?: string;
  sender?: string;
  region?: string;
}): Promise<IPromptResponse> => {
  if (!whatsAppTemplateName && !templateId) {
    return new PromptResponse('At least one of templateId or whatsAppTemplateName should be provided.').promptResponse;
  }

  const maybeAppId = getConversationAppId(appId);
  if (isPromptResponse(maybeAppId)) {
    return maybeAppId.promptResponse;
  }
  const conversationAppId = maybeAppId;

  const maybeClient = getConversationService();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const sinchClient = maybeClient;
  const conversationRegion = getConversationRegion(region);
  sinchClient.conversation.setRegion(conversationRegion);

  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
  let templateMessage: Conversation.TemplateMessageItem = {};
  if (whatsAppTemplateName && whatsAppTemplateLanguage) {
    const whatsappMessage: Conversation.TemplateMessageItem = {
      channel_template: {
        WHATSAPP: {
          template_id: whatsAppTemplateName,
          language_code: whatsAppTemplateLanguage,
          version: '',
          parameters: {
            ...parameters
          }
        }
      }
    };
    templateMessage = {
      ...templateMessage,
      ...whatsappMessage
    };
  }
  if (templateId) {
    const omniChannelMessage: Conversation.TemplateMessageItem = {
      omni_template: {
        template_id: templateId,
        version: 'latest',
        parameters: {
          ...parameters
        }
      }
    };
    if (language) {
      omniChannelMessage.omni_template!.language_code = language;
    }
    templateMessage = {
      ...templateMessage,
      ...omniChannelMessage
    };
  }
  const request: Conversation.SendTemplateMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        template_message: {
          ...templateMessage
        }
      }
    }
  };

  let response: Conversation.SendMessageResponse;
  let reply: string;
  try {
    response = await sinchClient.conversation.messages.sendTemplateMessage(request);
    reply = `Template message submitted on channel ${channel}! The message ID is ${response.message_id}`;
  } catch (error) {
    reply = `An error occurred when trying to send the text message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
  }

  return new PromptResponse(reply).promptResponse;
};
