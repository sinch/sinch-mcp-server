import { getVerificationService } from '../../../../src/tools/verification/utils/verification-service-helper';
import { ApiFetchClient, SinchClient, VERIFICATION_HOSTNAME } from '@sinch/sdk-core';
import { USER_AGENT } from '../../../../src/user-agent';

const mockApi = () => ({
  setHostname: jest.fn(),
});

jest.mock('@sinch/sdk-core', () => {
  const actual = jest.requireActual('@sinch/sdk-core');
  return {
    ...actual,
    SinchClient: jest.fn(() => ({
      verification: {
        verifications: mockApi(),
        verificationStatus: mockApi(),
      },
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
    process.env.VERIFICATION_APPLICATION_KEY = APPLICATION_KEY;
    process.env.VERIFICATION_APPLICATION_SECRET = 'test-application-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns a configured SinchClient from getVerificationService', async () => {
    const client = getVerificationService(TOOL_NAME);
    expect(client).toHaveProperty('verification');

    const apis = (client as SinchClient).verification;

    for(const api of Object.values(apis)) {
      expect(api.setHostname).toHaveBeenCalledWith(VERIFICATION_HOSTNAME);
      expect(api.client).toBeInstanceOf(ApiFetchClient);
      const userAgentPlugin = (api.client as ApiFetchClient).apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
      expect(userAgentPlugin).toBeDefined();
      const expectedUserAgent = USER_AGENT.replace('{toolName}', TOOL_NAME).replace('{projectId}', APPLICATION_KEY);
      expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
    }
  });

});
