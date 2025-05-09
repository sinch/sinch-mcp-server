import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient, Voice } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from '../verification/credentials.js';

export const registerTtsCallout = (server: McpServer) => {
  server.tool('tts-callout', 'Make a callout with a TTS prompt', {
    phoneNumber: z.string().describe('The phone number to call'),
    message: z.string().describe('The message to read out loud'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  },
  async({ phoneNumber, message, sessionId }) => {

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

    const request: Voice.TtsCalloutRequestData = {
      ttsCalloutRequestBody: {
        method: 'ttsCallout',
        ttsCallout: {
          destination: {
            type: 'number',
            endpoint: phoneNumber
          },
          text: message
        }
      }
    };
    if(cli) {
      request.ttsCalloutRequestBody.ttsCallout.cli = cli;
    }

    const response = await sinchClient.voice.callouts.tts(request);

    return {
      content: [
        {
          type: 'text',
          text: `Calling ${phoneNumber}... The call ID is ${response.callId}`
        }
      ]
    };
  });
};
