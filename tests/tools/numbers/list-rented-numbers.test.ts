import { listRentedNumbersHandler } from '../../../src/tools/numbers/list-rented-numbers';
import * as numbersServiceHelper from '../../../src/tools/numbers/utils/numbers-service-helper';
import { mockEnv, resetMockEnv } from '../../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const mockNumbersService = {
  list: jest.fn(),
};

describe('listRentedNumbersHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(numbersServiceHelper, 'getNumbersService').mockReturnValue(mockNumbersService as never);
    jest.clearAllMocks();
    resetMockEnv();
    mockEnv.PROJECT_ID = 'test-project';
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  it('maps the filters to the SDK query parameters', async () => {
    mockNumbersService.list.mockResolvedValue({ data: [], hasNextPage: false });

    await listRentedNumbersHandler({
      regionCode: 'US',
      type: 'LOCAL',
      searchPattern: '2020',
      patternPosition: 'START',
      capability: 'SMS',
      size: 5,
    });

    expect(mockNumbersService.list).toHaveBeenCalledWith({
      regionCode: 'US',
      type: 'LOCAL',
      'numberPattern.pattern': '2020',
      'numberPattern.searchPattern': 'START',
      capability: 'SMS',
      pageSize: 5,
    });
  });

  it('returns the first page of active numbers', async () => {
    mockNumbersService.list.mockResolvedValue({
      data: [{ phoneNumber: '+12015555555' }],
      hasNextPage: false,
    });

    const result = await listRentedNumbersHandler({});

    expect(result.content[0].text).toEqual(JSON.stringify({ success: true, data: [{ phoneNumber: '+12015555555' }] }));
  });

  it('returns an error when the list call fails', async () => {
    mockNumbersService.list.mockRejectedValue(new Error('Unauthorized'));

    const result = await listRentedNumbersHandler({});

    expect(result.content[0].text).toEqual(JSON.stringify({ success: false, error: 'Unauthorized' }));
  });
});
