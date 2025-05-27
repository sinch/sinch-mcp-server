import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationCredentials } from './utils/verification-service-helper';
import { isPromptResponse } from '../../utils';
import { USER_AGENT } from '../../user-agent';

interface NumberLookupResponse {
  line: {
    carrier: string;
    type: string;
    mobileCountryCode: string;
    mobileNetworkCode: string;
  };
  countryCode: string;
  number: string;
  traceId: string;
}

export const registerNumberLookup = (server: McpServer) => {
  server.tool(
    'number-lookup',
    'With quick and easy access to Number Lookup, you can enhance your communications and keep your database as clean as a whistle. Number Lookup checks against first-party numbering sources and provides real-time feedback. Improve communication by validating and verifying numbers, boosting delivery conversion rates, and saving money on marketing campaigns. Test numbers to ensure your recipients are ready and waiting to receive your messages!',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format to look up'),
    },
    async ({ phoneNumber }) => {
      console.error(`Looking up for phone number "${phoneNumber}"`);

      const maybeCredentials = await getVerificationCredentials();
      if (isPromptResponse(maybeCredentials)) {
        return maybeCredentials.promptResponse;
      }
      const credentials = maybeCredentials;

      // TODO: use the SinchClient once it supports the Number Lookup API to use the signed request instead of basic authentication
      const resp = await fetch(
        'https://number-lookup.api.sinch.com/v1/lookups',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + Buffer.from(`${credentials.applicationKey}:${credentials.applicationSecret}`).toString('base64'),
            'User-Agent': USER_AGENT
          },
          body: JSON.stringify({
            number: phoneNumber,
            features: ['LineType']
          })
        }
      );

      const data = await resp.json() as NumberLookupResponse;

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
