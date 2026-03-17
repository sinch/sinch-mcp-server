import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  NUMBERS_HOSTNAME,
  Oauth2TokenRequest,
} from '@sinch/sdk-client';
import { NumbersService } from '@sinch/numbers';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export function getNumbersService(
  toolName: string
): NumbersService | PromptResponse {
  const projectId = process.env.PROJECT_ID;
  const keyId     = process.env.KEY_ID;
  const keySecret = process.env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(JSON.stringify({
        success: false,
        error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'
      }));
  }

  const numbersService  = new NumbersService({
    projectId, keyId, keySecret
  });
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
  fetcher.apiClientOptions.hostname = NUMBERS_HOSTNAME;

  numbersService.availableNumber.client = fetcher;
  numbersService.activeNumber.client = fetcher;
  numbersService.availableRegions.client = fetcher;

  return numbersService;
}
