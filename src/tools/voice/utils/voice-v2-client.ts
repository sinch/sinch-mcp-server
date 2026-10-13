import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  DEFAULT_VOICE_V2_HOSTNAME,
  NUMBERS_HOSTNAME,
  NumbersService,
  VoiceV2Service,
} from '@sinch/sdk-core';
import { getSharedOauth2TokenRequest } from '../../../auth/oauth-token-cache';
import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { formatUserAgent, isPromptResponse } from '../../../utils';

export interface VoiceV2Client {
  voice: VoiceV2Service;
  numbers: NumbersService;
}

export const getVoiceV2Client = (toolName: string): VoiceV2Client | PromptResponse => {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials;
  }
  const { projectId } = maybeCredentials;
  const authenticationPlugin = getSharedOauth2TokenRequest(maybeCredentials);
  const additionalHeadersPlugin = new AdditionalHeadersRequest({
    headers: buildHeader('User-Agent', formatUserAgent(toolName, projectId)),
  });

  const voiceFetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [authenticationPlugin, additionalHeadersPlugin],
  });
  const numbersFetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [authenticationPlugin, additionalHeadersPlugin],
  });

  // Remove the VersionRequest plugins, as we override the user-agent header.
  voiceFetcher.apiClientOptions.requestPlugins?.shift();
  numbersFetcher.apiClientOptions.requestPlugins?.shift();
  voiceFetcher.apiClientOptions.hostname = DEFAULT_VOICE_V2_HOSTNAME;
  numbersFetcher.apiClientOptions.hostname = NUMBERS_HOSTNAME;

  const voice = new VoiceV2Service({});
  voice.lazyClient.apiFetchClient = voiceFetcher;

  const numbers = new NumbersService({});
  numbers.lazyClient.apiFetchClient = numbersFetcher;

  return {
    voice,
    numbers,
  };
};
