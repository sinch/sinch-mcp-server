import { getVoiceService } from '../../../../src/tools/voice/utils/voice-service-helper';
import { ApiFetchClient, VOICE_HOSTNAME } from '@sinch/sdk-client';
import { VoiceService } from '@sinch/voice';
import { formatUserAgent } from '../../../../src/utils';

const mockApi = () => ({
  setHostname: jest.fn(),
});

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('@sinch/voice', () => {
  const actual = jest.requireActual('@sinch/voice');
  return {
    ...actual,
    VoiceService: jest.fn(() => ({
      callouts: mockApi(),
      conferences: mockApi(),
      calls: mockApi(),
    })),
  }
});

describe('getVoiceService', () => {
  const OLD_ENV = process.env;
  const APPLICATION_KEY = 'test-application-key';
  const TOOL_NAME = 'dummy-tool';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.APPLICATION_KEY = APPLICATION_KEY;
    process.env.APPLICATION_SECRET = 'test-application-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns a configured VoiceService from getVoiceService', async () => {
    const service = getVoiceService(TOOL_NAME);
    expect(service).toHaveProperty('callouts');
    expect(service).toHaveProperty('conferences');
    expect(service).toHaveProperty('calls');

    const apis = service as VoiceService;

    for(const api of Object.values(apis)) {
      expect(api.setHostname).toHaveBeenCalledWith(VOICE_HOSTNAME.replace('{region}', ''));
      expect(api.client).toBeInstanceOf(ApiFetchClient);
      const userAgentPlugin = (api.client as ApiFetchClient).apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
      expect(userAgentPlugin).toBeDefined();
      const expectedUserAgent = formatUserAgent(TOOL_NAME, APPLICATION_KEY);
      expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
    }
  });

});
