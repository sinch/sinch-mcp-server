import { getNumbersService } from '../../../../src/tools/numbers/utils/numbers-service-helper';
import { ApiFetchClient, NUMBERS_HOSTNAME } from '@sinch/sdk-client';
import { NumbersService } from '@sinch/numbers';
import { formatUserAgent } from '../../../../src/utils';
import { PromptResponse } from '../../../../src/types';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

describe('getNumbersService', () => {
  const PROJECT_ID = 'test-project';
  const TOOL_NAME = 'release-rented-number';

  beforeEach(() => {
    resetMockEnv();
    mockEnv.PROJECT_ID = PROJECT_ID;
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  it('returns a configured NumbersService with production hostname', async () => {
    const service = getNumbersService(TOOL_NAME) as NumbersService;
    const numbersFetchClient = service.lazyClient.apiFetchClient;

    expect(numbersFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(numbersFetchClient!.apiClientOptions.hostname).toBe(NUMBERS_HOSTNAME);

    const userAgentPlugin = numbersFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin.getName() === 'AdditionalHeadersRequest',
    );
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

  it('returns prompt response when credentials are missing', () => {
    mockEnv.PROJECT_ID = undefined;

    const result = getNumbersService(TOOL_NAME);

    expect((result as PromptResponse).promptResponse.content[0].text).toContain(
      'Missing Sinch credentials',
    );
  });
});
