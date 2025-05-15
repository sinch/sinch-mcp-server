import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildSinchClient, getConversationCredentials } from './credentials.js';

export const registerSendTextMessage = (server: McpServer) => {
  server.tool(
    'send-text-message',
    'Send a text message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      contact: z.string().describe('The contact to send the text message to. This can be a phone number in E.164 format, or the identifier for the specified channel.'),
      message: z.string().describe('The text message to send.'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().describe('The ID of the app to use for the Sinch conversation API.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ message, contact, channel, appId, sessionId }) => {

      // Send text message
      console.error(`Sending text message to ${contact} on channel ${channel}: ${message}`);

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const sinchClient = buildSinchClient(credentials);
      const response = await sinchClient.conversation.messages.sendTextMessage({
        sendMessageRequestBody: {
          app_id: appId,
          message: {
            text_message: {
              text: message
            }
          },
          recipient: {
            contact_id: contact
          },
          processing_strategy: 'DISPATCH_ONLY'
        }
      });

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
