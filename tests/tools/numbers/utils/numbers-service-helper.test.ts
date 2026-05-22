import { getNumbersService } from '../../../../src/tools/numbers/utils/numbers-service-helper';
import { ApiFetchClient, NUMBERS_HOSTNAME } from '@sinch/sdk-client';
import { NumbersService } from '@sinch/numbers';
import { formatUserAgent } from '../../../../src/utils';
import { PromptResponse } from '../../../../src/types';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

describe('getNumbersService', () => {
  const OLD_ENV = process.env;
  const PROJECT_ID = 'test-project';
  const TOOL_NAME = 'release-rented-number';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.PROJECT_ID = PROJECT_ID;
    process.env.KEY_ID = 'test-key-id';
    process.env.KEY_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns a configured NumbersService with production hostname', async () => {
    const service = getNumbersService(TOOL_NAME) as NumbersService;
    const numbersFetchClient = service.lazyClient.apiFetchClient;

    expect(numbersFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(numbersFetchClient!.apiClientOptions.hostname).toBe(NUMBERS_HOSTNAME);

    const userAgentPlugin = numbersFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin.getName() === 'AdditionalHeadersRequest'
    );
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect(
      (await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']
    ).toBe(expectedUserAgent);
  });

  it('returns prompt response when credentials are missing', () => {
    delete process.env.PROJECT_ID;

    const result = getNumbersService(TOOL_NAME);

    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse.content[0].text).toContain(
      'Missing env vars'
    );
  });
});
