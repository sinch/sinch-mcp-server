import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { stripChannelsCredentials } from '../helpers/strip-channels-credentials.js';
import { buildSinchClient, getConversationCredentials } from './credentials.js';

export const registerListAllApps = (server: McpServer) => {
  server.tool(
    'list-all-apps',
    'Get a list of all Conversation apps in the account. Apps are created and configured in the Sinch Dashboard or with the Conversation API. The App is the entity that holds the credentials related to the various channels',
    {
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ sessionId }) => {
      console.error('Listing all apps');

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const sinchClient = buildSinchClient(credentials);
      const responseUS = await sinchClient.conversation.app.list({});

      sinchClient.conversation.setRegion('eu');
      const responseEU = await sinchClient.conversation.app.list({});

      sinchClient.conversation.setRegion('br');
      const responseBR = await sinchClient.conversation.app.list({});

      let reply = `List of conversations apps in the US region: ${JSON.stringify(stripChannelsCredentials(responseUS))}`;
      reply += `\nList of conversations apps in the EU region: ${JSON.stringify(stripChannelsCredentials(responseEU))}`;
      reply += `\nList of conversations apps in the BR region: ${JSON.stringify(stripChannelsCredentials(responseBR))}`;

      return {
        content: [
          {
            type: 'text',
            text: `${reply}.\nPlease return the data in a structured array format with each item on a separate line. Just display the Id, display name, channels and region columns. Example:
| ID   | Display name | Channels       | Region |
| 0123 | My app name  | SMS, MESSENGER | US     |`
          }
        ]
      };
    }
  );
};
