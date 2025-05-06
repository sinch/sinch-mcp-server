import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from './credentials.js';

export const registerStartVerificationWithSms = (server: McpServer) => {
  server.tool('start-sms-verification', 'Start new phone number verification requests. If the request is successful, you should ask the user to enter the OTP they received on the phone number we are verifying.', {
    phoneNumber: z.string().describe('Phone number in E.164 format to send the SMS to'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  }, async ({ phoneNumber, sessionId }) => {

    console.error(`Starting phone number verification via SMS "${phoneNumber}"`);

    const credentials = await getVerificationCredentials(sessionId);
    if ('promptResponse' in credentials) {
      console.error(`No verification credentials found for the session ${credentials.sessionId}`);
      return credentials.promptResponse;
    }

    const sinchClient = new SinchClient({
      applicationKey: credentials.appId,
      applicationSecret: credentials.appSecret
    });

    const response = await sinchClient.verification.verifications.startSms({
      startVerificationWithSmsRequestBody: {
        identity: {
          type: 'number',
          endpoint: phoneNumber
        }
      }
    });

    return {
      content: [
        {
          type: 'text',
          text: `Started verification for ${phoneNumber}. The verification ID is ${response.id}`
        }
      ]
    };
  });
};

