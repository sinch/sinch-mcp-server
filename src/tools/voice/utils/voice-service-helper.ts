import { PromptResponse } from '../../../types';
import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  XTimestampRequest,
  SigningRequest,
  SinchClient,
  VOICE_HOSTNAME,
  REGION_PATTERN,
  VoiceRegion,
} from '@sinch/sdk-core';
import { formatUserAgent } from '../../../utils';

// Hack: VoiceDomainApi is not exposed
interface ApiService {
  client: ApiFetchClient;
  setHostname: (hostname: string) => void;
}

const addPropertiesToApi = (api: ApiService, client: ApiFetchClient) => {
  api.client = client;
  api.setHostname(VOICE_HOSTNAME.replace(REGION_PATTERN, VoiceRegion.DEFAULT));
};

export const getVoiceClient = (toolName: string): SinchClient | PromptResponse => {

  const applicationKey = process.env.VOICE_APPLICATION_KEY;
  const applicationSecret = process.env.VOICE_APPLICATION_SECRET;

  if (!applicationKey && !applicationSecret) {
    return new PromptResponse(
      'Missing environment variables: "VOICE_APPLICATION_KEY" and "VOICE_APPLICATION_SECRET".'
    );
  }
  if (!applicationKey) {
    return new PromptResponse(
      'Missing environment variable: "VOICE_APPLICATION_KEY".'
    );
  }
  if (!applicationSecret) {
    return new PromptResponse(
      'Missing environment variable: "VOICE_APPLICATION_SECRET".'
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
    sinchClient.voice.callouts,
    sinchClient.voice.conferences,
    sinchClient.voice.calls,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient));

  return sinchClient;
};
