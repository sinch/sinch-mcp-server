import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from './credentials.js';

export const registerReportSmsVerification = (server: McpServer) => {
  server.tool('report-sms-verification', 'Report the received verification code to verify it, using the phone number of the user', {
    phoneNumber: z.string().describe('Phone number in E.164 format used to start the verification process'),
    oneTimePassword: z.string().describe('The code which was received by the user submitting the SMS verification.'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  }, async ({ phoneNumber, oneTimePassword, sessionId }) => {

    console.error(`Reporting the phone number verification for "${phoneNumber}"`);

    const credentials = await getVerificationCredentials(sessionId);
    if ('promptResponse' in credentials) {
      console.error(`No verification credentials found for the session ${credentials.sessionId}`);
      return credentials.promptResponse;
    }

    const sinchClient = new SinchClient({
      applicationKey: credentials.appId,
      applicationSecret: credentials.appSecret
    });

    const response = await sinchClient.verification.verifications.reportSmsByIdentity({
      endpoint: phoneNumber,
      reportSmsVerificationByIdentityRequestBody: {
        sms: {
          code: oneTimePassword
        }
      }
    });

    return response.status === 'SUCCESSFUL' ? {
      content: [
        {
          type: 'text',
          text: `Verification successful for number ${phoneNumber}. The verification ID is ${response.id}`
        }
      ]
    } : {
      content: [
        {
          type: 'text',
          text: `Failed to verify the phone number ${phoneNumber}. The verification ID is ${response.id}`
        }
      ]
    };
  });
};
