import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildSinchClient, getConversationCredentials } from './credentials.js';

export const registerSendMediaMessage = (server: McpServer) => {
  server.tool(
    'send-media-message',
    'Send a media message from URL given in parameter to a contact on the specified channel. The contact can be a contact ID, a phone number for the SMS or RCS channel, or a name to associate with a contact in the address book. The media must be specified with its URL.',
    {
      contact: z.string().describe('The contact to send the media message to. This can be a contact ID, a phone number in E.164 format, or a name to associate with a contact in the address book.'),
      url: z.string().describe('The URL of the media that will be the content of the mnessage.'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().describe('The ID of the app to use for the Sinch conversation API.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ url, contact, channel, appId, sessionId }) => {
      // Send media message
      console.error(`Sending media message to ${contact} on channel ${channel}: ${url}`);

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const sinchClient = buildSinchClient(credentials);

      const response = await sinchClient.conversation.messages.sendMediaMessage({
        sendMessageRequestBody: {
          app_id: appId,
          message: {
            media_message: {
              url: url
            }
          },
          recipient: {
            contact_id: contact
          }
        }
      });

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
