import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient, Voice } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from '../verification/credentials.js';

export const registerConferenceCallout = (server: McpServer) => {
  server.tool('conference-call', 'Call a phone number and connects it to a conference room when answered', {
    phoneNumbers: z.array(z.string()).describe('The phone numbers to call and connect to the conference room'),
    conferenceId: z.string().optional().describe('The conference room ID'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  },
  async ({ phoneNumbers, conferenceId, sessionId }) => {

    const credentials = await getVerificationCredentials(sessionId);
    if ('promptResponse' in credentials) {
      console.error(`No verification credentials found for the session ${credentials.sessionId}`);
      return credentials.promptResponse;
    }

    const sinchClient = new SinchClient({
      applicationKey: credentials.appId,
      applicationSecret: credentials.appSecret
    });

    const cli = process.env.CALLING_LINE_IDENTIFICATION;

    if (!conferenceId) {
      conferenceId = crypto.randomUUID();
    }

    const errors: { phoneNumber: string, error: string }[] = [];
    const successfulCalls: { phoneNumber: string, callId: string }[] = [];

    for (const phoneNumber of phoneNumbers) {
      const request: Voice.ConferenceCalloutRequestData = {
        conferenceCalloutRequestBody: {
          method: 'conferenceCallout',
          conferenceCallout: {
            destination: {
              type: 'number',
              endpoint: phoneNumber
            },
            conferenceId
          }
        }
      };
      if(cli) {
        request.conferenceCalloutRequestBody.conferenceCallout.cli = cli;
      }

      try {
        const response = await sinchClient.voice.callouts.conference(request);
        if (response.callId) {
          successfulCalls.push({
            phoneNumber: request.conferenceCalloutRequestBody.conferenceCallout.destination.endpoint,
            callId: response.callId
          });
        }
      } catch (error) {
        errors.push({
          phoneNumber: request.conferenceCalloutRequestBody.conferenceCallout.destination.endpoint,
          error: (error as Error).message
        });
      }
    }

    let result = '';

    if (successfulCalls.length > 0) {
      result += `Here is the list of phone numbers joining the conference ${conferenceId} and their associated callId (to be presented as a table):\n`;
      for (const call of successfulCalls) {
        result += `- ${call.phoneNumber} | ${call.callId}\n`;
      }
    }

    if (errors.length > 0) {
      result += '\nThe following phone numbers couldn\'t be called (to be presented with a list and error message):\n';
      for (const err of errors) {
        result += `- ${err.phoneNumber}\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };

  });
};
