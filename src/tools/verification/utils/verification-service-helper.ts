import { PromptResponse } from '../../../types';
import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  XTimestampRequest,
  SigningRequest,
  SinchClient,
  VERIFICATION_HOSTNAME,
} from '@sinch/sdk-core';
import { formatUserAgent } from '../../../utils';

export const getVerificationCredentials = (): PromptResponse | { applicationKey: string; applicationSecret: string; } => {
  const applicationKey = process.env.VERIFICATION_APPLICATION_KEY;
  const applicationSecret = process.env.VERIFICATION_APPLICATION_SECRET;

  if (!applicationKey || !applicationSecret) {
    return new PromptResponse(
      'Missing env vars: VERIFICATION_APPLICATION_KEY, VERIFICATION_APPLICATION_SECRET.'
    );
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

export const getVerificationService = (toolName: string): SinchClient | PromptResponse => {

  const applicationKey = process.env.VERIFICATION_APPLICATION_KEY;
  const applicationSecret = process.env.VERIFICATION_APPLICATION_SECRET;

  if (!applicationKey && !applicationSecret) {
    return new PromptResponse(
      'Missing environment variables: "VERIFICATION_APPLICATION_KEY" and "VERIFICATION_APPLICATION_SECRET".'
    );
  }
  if (!applicationKey) {
    return new PromptResponse(
      'Missing environment variable: "VERIFICATION_APPLICATION_KEY".'
    );
  }
  if (!applicationSecret) {
    return new PromptResponse(
      'Missing environment variable: "VERIFICATION_APPLICATION_SECRET".'
    );
  }

  const sinchClient  = new SinchClient({});
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
    sinchClient.verification.verifications,
    sinchClient.verification.verificationStatus,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient));

  return sinchClient;
};
