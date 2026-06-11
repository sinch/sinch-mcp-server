import { ApiFetchClient } from '@sinch/sdk-client';
import { VerificationService } from '@sinch/verification';
import { getVerificationService } from '../../../../src/tools/verification/utils/verification-service-helper';
import { formatUserAgent } from '../../../../src/utils';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

describe('getVerificationService', () => {
  const APPLICATION_KEY = 'test-application-key';
  const TOOL_NAME = 'dummy-tool';

  beforeEach(() => {
    resetMockEnv();
    mockEnv.APPLICATION_KEY = APPLICATION_KEY;
    mockEnv.APPLICATION_SECRET = 'test-application-secret';
  });

  test('returns a configured SinchClient from getVerificationService', async () => {
    const service = getVerificationService(TOOL_NAME) as VerificationService;
    const expectedHostname = 'https://verification.api.sinch.com';

    const verificationFetchClient = service.lazyClient.apiFetchClient;

    expect(verificationFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(verificationFetchClient!.apiClientOptions.hostname).toBe(expectedHostname);
    expect(verificationFetchClient!.apiClientOptions.requestPlugins?.length).toBe(3);

    const userAgentPlugin = verificationFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin.getName() === 'AdditionalHeadersRequest',
    );
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, APPLICATION_KEY);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });
});
