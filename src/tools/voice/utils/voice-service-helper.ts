import { PromptResponse } from '../../../types';
import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  XTimestampRequest,
  SigningRequest,
  VOICE_HOSTNAME,
  REGION_PATTERN,
  VoiceRegion,
} from '@sinch/sdk-client';
import { VoiceService } from '@sinch/voice';
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

export const getVoiceService = (toolName: string): VoiceService | PromptResponse => {

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

  const voiceService  = new VoiceService({});
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
    voiceService.callouts,
    voiceService.conferences,
    voiceService.calls,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient));

  return voiceService;
};
