import { numberLookupHandler } from '../../../src/tools/verification/number-lookup';
import { PromptResponse } from '../../../src/types';
import { getNumberLookupService } from '../../../src/tools/verification/utils/number-lookup-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/verification/utils/number-lookup-service-helper');

const mockLookupService = {
  lookup: jest.fn(),
};
(getNumberLookupService as jest.Mock).mockReturnValue(mockLookupService);

describe('numberLookupHandler', () => {
  const OLD_ENV = process.env;
  const PROJECT_ID = 'test-project';

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

  it('returns a prompt response with all the line data', async () => {
    // Given
    mockLookupService.lookup.mockResolvedValue({
      line: {
        carrier: 'CarrierX',
        type: 'mobile',
        mobileCountryCode: '123',
        mobileNetworkCode: '456'
      },
      countryCode: 'US',
      number: '+1234567890',
      traceId: 'trace-1234'
    });

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result.role).toBe('assistant');
    const expectedResponse = JSON.stringify({
      success: true,
      data: {
        line: {
          carrier: 'CarrierX',
          type: 'mobile',
          mobileCountryCode: '123',
          mobileNetworkCode: '456'
        },
        countryCode: 'US',
        number: '+1234567890',
        traceId: 'trace-1234'
      }
    });
    expect(result.content[0].text).toEqual(expectedResponse);
  });

  it('returns error if fetch response is not ok', async () => {
    // Given
    mockLookupService.lookup.mockRejectedValue(new Error('Unauthorized'));

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    const expectedResponse = JSON.stringify({
      success: false,
      error: 'Failed to look up number +1234567890: Unauthorized'
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
  });

});
