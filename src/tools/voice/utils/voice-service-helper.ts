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
  fetcher.apiClientOptions.hostname = VOICE_HOSTNAME.replace(REGION_PATTERN, VoiceRegion.DEFAULT);

  voiceService.lazyVoiceClient.apiFetchClient = fetcher;

  return voiceService;
};
