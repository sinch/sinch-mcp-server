import { ApiFetchClient, VERIFICATION_HOSTNAME } from '@sinch/sdk-client';
import { VerificationService } from '@sinch/verification';
import { getVerificationService } from '../../../../src/tools/verification/utils/verification-service-helper';
import { formatUserAgent } from '../../../../src/utils';

const mockApi = () => ({
  setHostname: jest.fn(),
});

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('@sinch/verification', () => {
  const actual = jest.requireActual('@sinch/verification');
  return {
    ...actual,
    VerificationService: jest.fn(() => ({
      verifications: mockApi(),
      verificationStatus: mockApi(),
    })),
  }
});

describe('getVerificationService', () => {
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

  test('returns a configured SinchClient from getVerificationService', async () => {
    const client = getVerificationService(TOOL_NAME);
    expect(client).toHaveProperty('verifications');
    expect(client).toHaveProperty('verificationStatus');

    const apis = client as VerificationService;

    for(const api of Object.values(apis)) {
      expect(api.setHostname).toHaveBeenCalledWith(VERIFICATION_HOSTNAME);
      expect(api.client).toBeInstanceOf(ApiFetchClient);
      const userAgentPlugin = (api.client as ApiFetchClient).apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
      expect(userAgentPlugin).toBeDefined();
      const expectedUserAgent = formatUserAgent(TOOL_NAME, APPLICATION_KEY);
      expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
    }
  });

});
