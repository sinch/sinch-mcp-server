import { z } from 'zod';
import {
  GetActiveNumberConfigurationSchema,
  getActiveNumberConfigurationHandler,
} from '../../../src/tools/numbers/get-active-number-configuration';
import * as numbersServiceHelper from '../../../src/tools/numbers/utils/numbers-service-helper';
import { PromptResponse } from '../../../src/types';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const PHONE_NUMBER = '+14155550100';
const SERVICE_ID = '6e124178-c29d-46a5-943c-5c2ae544aade';

const get = jest.fn();
const numbersService = {
  get,
};

describe('getActiveNumberConfigurationHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(numbersServiceHelper, 'getNumbersService').mockReturnValue(numbersService as never);
    jest.clearAllMocks();
  });

  it('returns the full active number with its current Voice configuration', async () => {
    const activeNumber = {
      phoneNumber: PHONE_NUMBER,
      projectId: 'test-project',
      displayName: 'Support line',
      regionCode: 'US',
      type: 'LOCAL',
      capability: ['SMS', 'VOICE'],
      money: {
        currencyCode: 'USD',
        amount: '2.00',
      },
      paymentIntervalMonths: 1,
      smsConfiguration: {
        servicePlanId: 'sms-service-plan',
      },
      voiceConfiguration: {
        type: 'RTC',
        appId: SERVICE_ID,
        scheduledVoiceProvisioning: null,
      },
    };
    get.mockResolvedValue(activeNumber);

    const result = await getActiveNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(get).toHaveBeenCalledWith({ phoneNumber: PHONE_NUMBER });
    expect(JSON.parse(result.content[0].text)).toEqual({
      success: true,
      data: activeNumber,
    });
  });

  it.each(['WAITING', 'IN_PROGRESS', 'FAILED'])(
    'returns scheduled Voice provisioning with %s status',
    async (status) => {
      const activeNumber = {
        phoneNumber: PHONE_NUMBER,
        capability: ['VOICE'],
        voiceConfiguration: {
          type: 'RTC',
          scheduledVoiceProvisioning: {
            type: 'RTC',
            appId: SERVICE_ID,
            status,
            lastUpdatedTime: '2026-10-09T07:30:00.000Z',
          },
        },
      };
      get.mockResolvedValue(activeNumber);

      const result = await getActiveNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

      expect(JSON.parse(result.content[0].text)).toEqual({
        success: true,
        data: activeNumber,
      });
    },
  );

  it('returns a not-found API error through the established failure response', async () => {
    get.mockRejectedValue(new Error('404 Not Found: active number does not exist'));

    const result = await getActiveNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      error: `Failed to retrieve active number '${PHONE_NUMBER}': 404 Not Found: active number does not exist`,
    });
  });

  it('returns other Numbers API errors through the established failure response', async () => {
    get.mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await getActiveNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      error: `Failed to retrieve active number '${PHONE_NUMBER}': 503 Service Unavailable`,
    });
  });

  it('returns the credential guard response without calling the API', async () => {
    const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
    jest.spyOn(numbersServiceHelper, 'getNumbersService').mockReturnValue(guard);

    const result = await getActiveNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(result).toBe(guard.promptResponse);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('GetActiveNumberConfigurationSchema', () => {
  const schema = z.object(GetActiveNumberConfigurationSchema);

  it.each([PHONE_NUMBER, '+33612345678', '+12025550134'])('accepts E.164 number %s', (phoneNumber) => {
    expect(schema.safeParse({ phoneNumber }).success).toBeTrue();
  });

  it.each(['4155550100', '004155550100', '+0123456789', '+1', '+1234567890123456', '+1 415 555 0100'])(
    'rejects invalid phone number %s',
    (phoneNumber) => {
      expect(schema.safeParse({ phoneNumber }).success).toBeFalse();
    },
  );
});
