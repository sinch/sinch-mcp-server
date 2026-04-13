import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  NUMBER_LOOKUP_HOSTNAME,
  Oauth2TokenRequest,
} from '@sinch/sdk-client';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';
import { NumberLookupService } from '@sinch/number-lookup';

export function getNumberLookupService(
  toolName: string
): NumberLookupService | PromptResponse {
  const projectId = process.env.PROJECT_ID;
  const keyId     = process.env.KEY_ID;
  const keySecret = process.env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'
    }));
  }

  const numberLookupService = new NumberLookupService({});
  const fetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [
      new Oauth2TokenRequest(keyId, keySecret),
      new AdditionalHeadersRequest({
        headers: buildHeader(
          'User-Agent',
          formatUserAgent(toolName, projectId),
        ),
      }),
    ],
  });
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  fetcher.apiClientOptions.hostname = NUMBER_LOOKUP_HOSTNAME;

  numberLookupService.lazyClient.apiFetchClient = fetcher;

  return numberLookupService;
}
