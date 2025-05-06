import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationCredentials } from './credentials.js';

export const registerNumberLookup = (server: McpServer) => {
  server.tool(
    'number-lookup',
    'With quick and easy access to Number Lookup, you can enhance your communications and keep your database as clean as a whistle. Number Lookup checks against first-party numbering sources and provides real-time feedback. Improve communication by validating and verifying numbers, boosting delivery conversion rates, and saving money on marketing campaigns. Test numbers to ensure your recipients are ready and waiting to receive your messages!',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format to look up'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ phoneNumber, sessionId }) => {

      console.error(`Looking up for phone number "${phoneNumber}"`);

      const credentials = await getVerificationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No verification credentials found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      // The Node.js SDK for Sinch does not support the Number Lookup API, so we need to use the REST API directly
      // TODO: use the SinchClient once it supports the Number Lookup API to use the signed request instead of basic authentication
      const resp = await fetch(
        'https://number-lookup.api.sinch.com/v1/lookups',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + Buffer.from(`${credentials.appId}:${credentials.appSecret}`).toString('base64')
          },
          body: JSON.stringify({
            number: phoneNumber,
            features: ['LineType']
          })
        }
      );

      const data = await resp.json();

      return {
        content: [
          {
            type: 'text',
            text: `Line type features: carrier ${data.line.carrier}, type: ${data.line.type}), mobileCountryCode: ${data.line.mobileCountryCode}, mobileNetworkCode: ${data.line.mobileNetworkCode}, countryCode: ${data.countryCode}, number: ${data.number}, traceId: ${data.traceId}`
          }
        ]
      };
    }
  );
};
