import { PromptResponse } from '../../../types';
import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  XTimestampRequest,
  SigningRequest,
  VERIFICATION_HOSTNAME,
} from '@sinch/sdk-client';
import { VerificationService } from '@sinch/verification';
import { formatUserAgent } from '../../../utils';

export const getVerificationService = (toolName: string): VerificationService | PromptResponse => {

  const applicationKey = process.env.APPLICATION_KEY;
  const applicationSecret = process.env.APPLICATION_SECRET;

  if (!applicationKey && !applicationSecret) {
    return new PromptResponse(
      'Missing environment variables: "APPLICATION_KEY" and "APPLICATION_SECRET".'
    );
  }
  if (!applicationKey) {
    return new PromptResponse(
      'Missing environment variable: "APPLICATION_KEY".'
    );
  }
  if (!applicationSecret) {
    return new PromptResponse(
      'Missing environment variable: "APPLICATION_SECRET".'
    );
  }

  const verificationService  = new VerificationService({});
  const fetcher = new ApiFetchClient({
    requestPlugins: [
      new XTimestampRequest(),
      new SigningRequest(applicationKey, applicationSecret),
      new AdditionalHeadersRequest({
        headers: buildHeader(
          'User-Agent',
          formatUserAgent(toolName, applicationKey),
        ),
      }),
    ],
  });
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  fetcher.apiClientOptions.hostname = VERIFICATION_HOSTNAME;

  verificationService.lazyClient.apiFetchClient = fetcher;

  return verificationService;
};
