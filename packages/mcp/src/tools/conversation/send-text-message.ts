import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { buildSinchClient, getConversationAppId, getConversationCredentials } from './credentials.js';
import { buildMessageBase } from './messageBuilder.js';

export const registerSendTextMessage = (server: McpServer) => {
  server.tool(
    'send-text-message',
    'Send a text message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      contact: z.string().describe('The contact to send the text message to. This can be a phone number in E.164 format, or the identifier for the specified channel.'),
      message: z.string().describe('The text message to send.'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_APP_ID.'),
      sender: z.string().optional().describe('(Optional) The sender of the message. It is a phone number in E.164 format.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ message, contact, channel, appId, sender, sessionId }) => {
      // Send text message
      console.error(`Sending text message to ${contact} on channel ${channel}: ${message}`);

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
      const requestBase = buildMessageBase(conversationAppId, contact, channel);
      const request: Conversation.SendTextMessageRequestData<Conversation.IdentifiedBy> = {
        sendMessageRequestBody: {
          ...requestBase,
          message: {
            text_message: {
              text: message
            }
          }
        }
      };

      if(!sender) {
        sender = process.env.DEFAULT_SMS_ORIGINATOR;
      }
      if (sender) {
        request.sendMessageRequestBody.channel_properties = {
          'SMS_SENDER': sender
        };
      }

      const response = await sinchClient.conversation.messages.sendTextMessage(request);

      return {
        content: [
          {
            type: 'text',
            text: `Text message submitted on channel ${channel}! The message ID is ${response.message_id}`
          }
        ]
      };
    });
};
