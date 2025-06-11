import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationCredentials } from './utils/verification-service-helper';
import { hasMatchingTag, isPromptResponse } from '../../utils';
import { USER_AGENT } from '../../user-agent';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

interface NumberLookupResponse {
  line?: {
    carrier?: string;
    type?: string;
    mobileCountryCode?: string;
    mobileNetworkCode?: string;
  };
  countryCode?: string;
  number?: string;
  traceId?: string;
}

export const registerNumberLookup = (server: McpServer, tags: Tags[]) => {
  if (!hasMatchingTag(['all', 'verification'], tags)) {
    return;
  }

  server.tool(
    'number-lookup',
    'With quick and easy access to Number Lookup, you can enhance your communications and keep your database as clean as a whistle. Number Lookup checks against first-party numbering sources and provides real-time feedback. Improve communication by validating and verifying numbers, boosting delivery conversion rates, and saving money on marketing campaigns. Test numbers to ensure your recipients are ready and waiting to receive your messages!',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format to look up'),
    },
    numberLookupHandler
  );
};

export const numberLookupHandler = async (
  { phoneNumber }: { phoneNumber: string }
): Promise<IPromptResponse> => {
  const maybeCredentials = getVerificationCredentials();
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

  if (!resp.ok) {
    const errorText = await resp.text();
    return new PromptResponse(`Failed to look up number ${phoneNumber}. Status: ${resp.status}, Error: ${errorText}`).promptResponse;
  }

  const data = await resp.json() as NumberLookupResponse;

  if (!data.line || !data.line.carrier || !data.line.type || !data.countryCode || !data.number) {
    return new PromptResponse(`Number lookup for ${phoneNumber} returned incomplete data.`).promptResponse;
  }

  return new PromptResponse(`Line type features: carrier ${data.line.carrier}, type: ${data.line.type}), mobileCountryCode: ${data.line.mobileCountryCode}, mobileNetworkCode: ${data.line.mobileNetworkCode}, countryCode: ${data.countryCode}, number: ${data.number}, traceId: ${data.traceId}`).promptResponse;
};
