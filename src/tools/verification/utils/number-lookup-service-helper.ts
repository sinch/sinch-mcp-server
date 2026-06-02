import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  NUMBER_LOOKUP_HOSTNAME,
} from '@sinch/sdk-client';
import { NumberLookupService } from '@sinch/number-lookup';
import { getSharedOauth2TokenRequest } from '../../../auth/oauth-token-cache';
import { resolveSinchOAuthCredentials } from '../../../auth/sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export function getNumberLookupService(toolName: string): NumberLookupService | PromptResponse {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (maybeCredentials instanceof PromptResponse) {
    return maybeCredentials;
  }
  const { projectId } = maybeCredentials;

  const numberLookupService = new NumberLookupService({});
  const fetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [
      getSharedOauth2TokenRequest(maybeCredentials),
      new AdditionalHeadersRequest({
        headers: buildHeader('User-Agent', formatUserAgent(toolName, projectId)),
      }),
    ],
  });
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  fetcher.apiClientOptions.hostname = NUMBER_LOOKUP_HOSTNAME;

  numberLookupService.lazyClient.apiFetchClient = fetcher;

  return numberLookupService;
}
