import { AdditionalHeadersRequest, ApiFetchClient, buildHeader, NUMBERS_HOSTNAME } from '@sinch/sdk-client';
import { NumbersService } from '@sinch/numbers';
import { getSharedOauth2TokenRequest } from '../../../auth/oauth-token-cache';
import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';
import { timedSdkFetchClient } from '../../../telemetry/sinch-api-metrics';

export function getNumbersService(toolName: string): NumbersService | PromptResponse {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (maybeCredentials instanceof PromptResponse) {
    return maybeCredentials;
  }
  const { projectId } = maybeCredentials;

  const numbersService = new NumbersService({});
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
    'numbers',
  );
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  fetcher.apiClientOptions.hostname = NUMBERS_HOSTNAME;

  numbersService.lazyClient.apiFetchClient = fetcher;

  return numbersService;
}
