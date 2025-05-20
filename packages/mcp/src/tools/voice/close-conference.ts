import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from '../verification/credentials.js';


export const registerCloseConference = (server: McpServer) => {
  server.tool('close-conference', 'Close a conference callout', {
    conferenceId: z.string().describe('The conference ID to close'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  },
  async ({ conferenceId, sessionId }) => {

    const credentials = await getVerificationCredentials(sessionId);
    if ('promptResponse' in credentials) {
      console.error(`No verification credentials found for the session ${credentials.sessionId}`);
      return credentials.promptResponse;
    }

    const sinchClient = new SinchClient({
      applicationKey: credentials.appId,
      applicationSecret: credentials.appSecret
    });

    await sinchClient.voice.conferences.kickAll({
      conferenceId
    });

    return {
      content: [
        {
          type: 'text',
          text: 'All participants have been kicked from the conference.'
        }
      ]
    };

  });
};
