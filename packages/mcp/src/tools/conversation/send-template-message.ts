import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import {
  buildSinchClient,
  getConversationAppId,
  getConversationCredentials,
  getConversationRegion
} from './credentials.js';
import { buildMessageBase } from './messageBuilder.js';

const ChannelEnum = z.enum([
  'WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM',
  'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT',
  'LINE', 'WECHAT'
]);

export const registerSendTemplateMessage = (server: McpServer) => {
  server.tool(
    'send-template-message',
    'Send a template message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      contact: z.string().describe('The contact to send the template message to. This can be a phone number in E.164 format, or the identifier for the specified channel.'),
      templateId: z.string().optional().describe('The ID (ULID format) of the omni-template template to use for sending the message.'),
      language: z.string().optional().describe('The language to use for the omni-template (BCP-47). If not set, the default language code will be used.'),
      templateName: z.string().optional().describe('The name of the template to use for sending the message on WhatsApp specifically. At least one of templateId or templateName should be provided. If this is the template name, the message will be sent as a WhatsApp message, otherwise, it will be considered as an omni-channel message.'),
      languageWhatsapp: z.string().optional().describe('The language to use for the WhatsApp template (BCP-47). It is mandatory is the templateName is provided.'),
      parameters: z.record(z.string(), z.string()).optional().describe('The parameters to use for the template. This is a key-value map where the key is the parameter name and the value is the parameter value.'),
      channel: z.union([ChannelEnum, z.array(ChannelEnum).nonempty()])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\' or \'WECHAT\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_APP_ID.'),
      sender: z.string().optional().describe('The sender of the message. It is a phone number in E.164 format.'),
      region: z.enum(['us', 'eu', 'br']).optional().describe('The region to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_REGION.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ contact, templateId, language, templateName, languageWhatsapp, parameters, channel, appId, sender, region, sessionId }) => {

      console.error(`Sending template message to ${contact} on channel ${channel}`);

      if (!templateName && !templateId) {
        return {
          content: [
            {
              type: 'text',
              text: 'At least one of templateId or templateName should be provided.'
            }
          ]
        };
      }

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const conversationAppId = getConversationAppId(appId);
      if (typeof conversationAppId !== 'string') {
        console.error('No app ID provided.');
        return conversationAppId;
      }

      const sinchClient = buildSinchClient(credentials);
      const conversationRegion = getConversationRegion(region);
      sinchClient.conversation.setRegion(conversationRegion);

      const requestBase = await buildMessageBase(sinchClient, conversationAppId, contact, channel, sender);
      let templateMessage: Conversation.TemplateMessageItem = {};
      if (templateName && languageWhatsapp) {
        const whatsappMessage: Conversation.TemplateMessageItem = {
          channel_template: {
            WHATSAPP: {
              template_id: templateName,
              language_code: languageWhatsapp,
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

      console.error(JSON.stringify(request, null, 2));

      let response: Conversation.SendMessageResponse;
      let reply: string;
      try{
        response = await sinchClient.conversation.messages.sendTemplateMessage(request);
        reply = `Template message submitted on channel ${channel}! The message ID is ${response.message_id}`;
      } catch (error) {
        reply = `An error occurred when trying to send the text message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: reply
          }
        ]
      };
    });

};
