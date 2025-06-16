import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Tags } from '../../types';
import { matchesAnyTag } from '../../utils';

export const registerAppId = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(['all', 'conversation', 'notification'], tags)) {
    return;
  }

  server.prompt(
    'conversation-app-id',
    {
      appId: z.string().describe('The ID of the app to use for the Sinch conversation API')
    },
    ({ appId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please include the app ID ${appId} when the request will require to use a tool related to the Sinch Conversation API.`
          }
        }
      ]
    })
  );
};
