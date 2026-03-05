import { numberLookupHandler } from '../../../src/tools/verification/number-lookup';
import * as verificationHelper from '../../../src/tools/verification/utils/verification-service-helper';
import { PromptResponse } from '../../../src/types';
import { formatUserAgent } from '../../../src/utils';

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
    const expectedResponse = JSON.stringify({
      success: true,
      data: {
        phone_number: '+1234567890',
        carrier: 'CarrierX',
        type: 'mobile',
        mobile_country_code: '123',
        mobile_network_code: '456',
        country_code: 'US',
        trace_id: 'trace-1234'
      }
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_url, options] = mockedFetch.mock.calls[0];
    expect(options?.method).toBe('POST');
    const expectedUserAgent = formatUserAgent('number-lookup', mockCredentials.applicationKey);
    expect((options?.headers as any)['User-Agent']).toBe(expectedUserAgent);
  })

  it('returns error if getVerificationCredentials returns a PromptResponse', async () => {
    // Given
    const promptResponse = new PromptResponse(JSON.stringify({
      success: false,
      error: 'Credential error'
    }));
    jest.spyOn(verificationHelper, 'getVerificationCredentials').mockReturnValue(promptResponse);

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    expect(result).toEqual(promptResponse.promptResponse);
  });

  it('returns error if fetch response is not ok', async () => {
    // Given
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Unauthorized'
    });

    // When
    const result = await numberLookupHandler({ phoneNumber: '+1234567890' });

    // Then
    const expectedResponse = JSON.stringify({
      success: false,
      error: '(401 - Unauthorized) Failed to look up number +1234567890: Unauthorized'
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
  });

});
