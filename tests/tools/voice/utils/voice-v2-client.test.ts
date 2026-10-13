import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  DEFAULT_VOICE_V2_HOSTNAME,
  NUMBERS_HOSTNAME,
  Oauth2TokenRequest,
} from '@sinch/sdk-core';
import { clearOauthTokenCacheForTests } from '../../../../src/auth/oauth-token-cache';
import { PromptResponse } from '../../../../src/types';
import { formatUserAgent } from '../../../../src/utils';
import { getVoiceV2Client, VoiceV2Client } from '../../../../src/tools/voice/utils/voice-v2-client';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

describe('getVoiceV2Client', () => {
  const PROJECT_ID = 'test-project';
  const TOOL_NAME = 'tts-callout';

  beforeEach(() => {
    resetMockEnv();
    clearOauthTokenCacheForTests();
    mockEnv.PROJECT_ID = PROJECT_ID;
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  it('configures Voice and Numbers with shared OAuth and the MCP user-agent', async () => {
    const client = getVoiceV2Client(TOOL_NAME) as VoiceV2Client;
    const voiceFetcher = client.voice.lazyClient.apiFetchClient;
    const numbersFetcher = client.numbers.lazyClient.apiFetchClient;

    expect(voiceFetcher).toBeInstanceOf(ApiFetchClient);
    expect(numbersFetcher).toBeInstanceOf(ApiFetchClient);
    expect(voiceFetcher!.apiClientOptions.hostname).toBe(DEFAULT_VOICE_V2_HOSTNAME);
    expect(numbersFetcher!.apiClientOptions.hostname).toBe(NUMBERS_HOSTNAME);

    const voiceOauth = voiceFetcher!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin instanceof Oauth2TokenRequest,
    );
    const numbersOauth = numbersFetcher!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin instanceof Oauth2TokenRequest,
    );
    expect(voiceOauth).toBeDefined();
    expect(numbersOauth).toBe(voiceOauth);

    const userAgentPlugin = voiceFetcher!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin instanceof AdditionalHeadersRequest,
    );
    expect(userAgentPlugin).toBeDefined();
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(
      formatUserAgent(TOOL_NAME, PROJECT_ID),
    );
  });

  it('reuses the cached OAuth plugin across client instances', () => {
    const first = getVoiceV2Client(TOOL_NAME) as VoiceV2Client;
    const second = getVoiceV2Client(TOOL_NAME) as VoiceV2Client;

    const firstOauth = first.voice.lazyClient.apiFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin instanceof Oauth2TokenRequest,
    );
    const secondOauth = second.voice.lazyClient.apiFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin instanceof Oauth2TokenRequest,
    );

    expect(secondOauth).toBe(firstOauth);
  });

  it('returns a prompt response when credentials are missing', () => {
    mockEnv.PROJECT_ID = undefined;

    const result = getVoiceV2Client(TOOL_NAME);

    expect(result).toBeInstanceOf(PromptResponse);
  });
});
