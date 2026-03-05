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

export const getVerificationCredentials = (): PromptResponse | { applicationKey: string; applicationSecret: string; } => {
  const applicationKey = process.env.APPLICATION_KEY;
  const applicationSecret = process.env.APPLICATION_SECRET;

  if (!applicationKey || !applicationSecret) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: 'Missing env vars: APPLICATION_KEY, APPLICATION_SECRET.'
    }));
  }

  return {
    applicationKey,
    applicationSecret,
  };
}

// Hack: VerificationDomainApi is not exposed
interface ApiService {
  client: ApiFetchClient;
  setHostname: (hostname: string) => void;
}

const addPropertiesToApi = (api: ApiService, client: ApiFetchClient) => {
  api.client = client;
  api.setHostname(VERIFICATION_HOSTNAME);
};

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
  const apiFetchClient = new ApiFetchClient({
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

  const apis = [
    verificationService.verifications,
    verificationService.verificationStatus,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient));

  return verificationService;
};
