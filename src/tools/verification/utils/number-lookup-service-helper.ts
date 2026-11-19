import { AdditionalHeadersRequest, ApiFetchClient, buildHeader } from '@sinch/sdk-client';
import { NumberLookupService } from '@sinch/number-lookup';
import { getSharedOauth2TokenRequest } from '../../../auth/oauth-token-cache';
import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { getSinchNumberLookupUrl } from '../../../sinch-api-hosts';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';
import { timedSdkFetchClient } from '../../../telemetry/sinch-api-metrics';

export function getNumberLookupService(toolName: string): NumberLookupService | PromptResponse {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (maybeCredentials instanceof PromptResponse) {
    return maybeCredentials;
  }
  const { projectId } = maybeCredentials;

  const numberLookupService = new NumberLookupService({});
  const fetcher = timedSdkFetchClient(
    new ApiFetchClient({
      projectId,
      requestPlugins: [
        getSharedOauth2TokenRequest(maybeCredentials),
        new AdditionalHeadersRequest({
          headers: buildHeader('User-Agent', formatUserAgent(toolName, projectId)),
        }),
      ],
    }),
    'number_lookup',
  );
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  fetcher.apiClientOptions.hostname = getSinchNumberLookupUrl();

  numberLookupService.lazyClient.apiFetchClient = fetcher;

  return numberLookupService;
}
