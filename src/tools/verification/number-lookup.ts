import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationCredentials } from './utils/verification-service-helper';
import { formatUserAgent, isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getToolName, VerificationToolKey, verificationToolsConfig } from './utils/verification-tools-helper';

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

const TOOL_KEY: VerificationToolKey = 'numberLookup';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerNumberLookup = (server: McpServer, tags: Tags[]) => {
  if(!matchesAnyTag(tags, verificationToolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'With quick and easy access to Number Lookup, you can enhance your communications and keep your database as clean as a whistle. Number Lookup checks against first-party numbering sources and provides real-time feedback. Test numbers to ensure your recipients are ready and waiting to receive your messages!',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format to look up'),
    },
    numberLookupHandler
  );
};

export const numberLookupHandler = async (
  { phoneNumber }: { phoneNumber: string }
): Promise<IPromptResponse> => {
  try {
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
          'User-Agent': formatUserAgent(TOOL_NAME, credentials.applicationKey),
        },
        body: JSON.stringify({
          number: phoneNumber,
          features: ['LineType']
        })
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      return new PromptResponse(JSON.stringify({
        success: false,
        error: `(${resp.status} - ${resp.statusText}) Failed to look up number ${phoneNumber}: ${errorText}`
      })).promptResponse;
    }

    const data = await resp.json() as NumberLookupResponse;

    return new PromptResponse(JSON.stringify({
      phone_number: data.number,
      carrier: data.line?.carrier,
      type: data.line?.type,
      mobile_country_code: data.line?.mobileCountryCode,
      mobile_network_code: data.line?.mobileNetworkCode,
      country_code: data.countryCode,
      trace_id: data.traceId
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }

};
