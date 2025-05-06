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
      const response = await sinchClient.conversation.app.list({});

      console.error(JSON.stringify(stripChannelsCredentials(response), null, 2));

      return {
        content: [
          {
            type: 'text',
            text: `Here is the list of all the apps: ${JSON.stringify(stripChannelsCredentials(response), null, 2)}. Please present them in a form of an array with these columns: ID / Display name / channels names`
          }
        ]
      };
    }
  );
};
