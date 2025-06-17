import { numberLookupHandler } from '../../../src/tools/verification/number-lookup';
import * as verificationHelper from '../../../src/tools/verification/utils/verification-service-helper';
import { PromptResponse } from '../../../src/types';

global.fetch = jest.fn();

describe('numberLookupHandler', () => {
  const mockedFetch = fetch as jest.Mock;

  const mockCredentials = {
    applicationKey: 'application-key',
    applicationSecret: 'application-secret'
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(verificationHelper, 'getVerificationCredentials').mockReturnValue(mockCredentials)
  });

  it('returns a prompt response with all the line data', async () => {
    // Given
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        line: {
          carrier: 'CarrierX',
          type: 'mobile',
          mobileCountryCode: '123',
          mobileNetworkCode: '456'
        },
        countryCode: 'US',
        number: '+1234567890',
        traceId: 'trace-1234'
      })
    });

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result.role).toBe('assistant');
    expect(result).toEqual(new PromptResponse('Line type features: carrier CarrierX, type: mobile), mobileCountryCode: 123, mobileNetworkCode: 456, countryCode: US, number: +1234567890, traceId: trace-1234').promptResponse);
  })

  it('returns error if getVerificationCredentials returns a PromptResponse', async () => {
    // Given
    jest.spyOn(verificationHelper, 'getVerificationCredentials').mockReturnValue(new PromptResponse('Credential error'));

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result).toEqual(new PromptResponse('Credential error').promptResponse);
  });

  it('returns error if fetch response is not ok', async () => {
    // Given
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result).toEqual(new PromptResponse('Failed to look up number +1234567890. Status: 401, Error: Unauthorized').promptResponse);
  });

  it('returns error if response contains incomplete data', async () => {
    // Given
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        line: {},
        countryCode: 'US',
        number: '+1234567890'
      })
    });

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result).toEqual(new PromptResponse('Number lookup for +1234567890 returned incomplete data.').promptResponse);
  });

});
