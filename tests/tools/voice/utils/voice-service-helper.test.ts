import { getVoiceService } from '../../../../src/tools/voice/utils/voice-service-helper';
import { ApiFetchClient } from '@sinch/sdk-client';
import { VoiceService } from '@sinch/voice';
import { formatUserAgent } from '../../../../src/utils';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

describe('getVoiceService', () => {
  const APPLICATION_KEY = 'test-application-key';
  const TOOL_NAME = 'dummy-tool';

  beforeEach(() => {
    resetMockEnv();
    mockEnv.APPLICATION_KEY = APPLICATION_KEY;
    mockEnv.APPLICATION_SECRET = 'test-application-secret';
  });

  test('returns a configured VoiceService from getVoiceService', async () => {
    const service = getVoiceService(TOOL_NAME) as VoiceService;
    const expectedHostname = 'https://calling.api.sinch.com';

    const voiceFetchClient = service.lazyVoiceClient.apiFetchClient;

    expect(voiceFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(voiceFetchClient!.apiClientOptions.hostname).toBe(expectedHostname);
    expect(voiceFetchClient!.apiClientOptions.requestPlugins?.length).toBe(3);

    const userAgentPlugin = voiceFetchClient!.apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, APPLICATION_KEY);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

});
