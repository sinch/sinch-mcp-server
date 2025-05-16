import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { buildSinchClient, getConversationAppId, getConversationCredentials } from './credentials.js';
import { buildMessageBase } from './messageBuilder.js';

export const registerSendMediaMessage = (server: McpServer) => {
  server.tool(
    'send-media-message',
    'Send a media message from URL given in parameter to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel. The media must be specified with its URL.',
    {
      contact: z.string().describe('The contact to send the media message to. This can be a phone number in E.164 format, or the identifier for the specified channel..'),
      url: z.string().describe('The URL of the media that will be the content of the message.'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API.'),
      sender: z.string().optional().describe('(Optional) The sender of the message. It is a phone number in E.164 format.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ url, contact, channel, appId, sender, sessionId }) => {
      // Send media message
      console.error(`Sending media message to ${contact} on channel ${channel}: ${url}`);

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
      const request: Conversation.SendMediaMessageRequestData<Conversation.IdentifiedBy> = {
        sendMessageRequestBody: {
          ...requestBase,
          message: {
            media_message: {
              url: url
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

      const response = await sinchClient.conversation.messages.sendMediaMessage(request);

      return {
        content: [
          {
            type: 'text',
            text: `Media message submitted on channel ${channel}! The message ID is ${response.message_id}`
          }
        ]
      };
    });
};
