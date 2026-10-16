import { z } from 'zod';
import {
  GetRentedNumberConfigurationSchema,
  getRentedNumberConfigurationHandler,
} from '../../../src/tools/numbers/get-rented-number-configuration';
import * as numbersServiceHelper from '../../../src/tools/numbers/utils/numbers-service-helper';
import { PromptResponse } from '../../../src/types';

const PHONE_NUMBER = '+14155550100';

const get = jest.fn();
const numbersService = { get };

describe('getRentedNumberConfigurationHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(numbersServiceHelper, 'getNumbersService').mockReturnValue(numbersService as never);
  });

  it('returns the full rented number with its current service configuration', async () => {
    const rentedNumber = {
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
        campaignId: 'sms-campaign',
      },
      voiceConfiguration: {
        type: 'EST',
        trunkId: 'elastic-sip-trunk',
        scheduledVoiceProvisioning: null,
      },
    };
    get.mockResolvedValue(rentedNumber);

    const result = await getRentedNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(get).toHaveBeenCalledWith({ phoneNumber: PHONE_NUMBER });
    expect(JSON.parse(result.content[0].text)).toEqual({
      success: true,
      data: rentedNumber,
    });
  });

  it('returns future service configuration while asynchronous provisioning is in progress', async () => {
    const rentedNumber = {
      phoneNumber: PHONE_NUMBER,
      capability: ['SMS', 'VOICE'],
      smsConfiguration: {
        servicePlanId: 'current-service-plan',
        scheduledProvisioning: {
          servicePlanId: 'future-service-plan',
          campaignId: 'future-campaign',
          status: 'IN_PROGRESS',
        },
      },
      voiceConfiguration: {
        type: 'RTC',
        scheduledVoiceProvisioning: {
          type: 'RTC',
          appId: '6e124178-c29d-46a5-943c-5c2ae544aade',
          status: 'IN_PROGRESS',
          lastUpdatedTime: '2026-10-09T07:30:00.000Z',
        },
      },
    };
    get.mockResolvedValue(rentedNumber);

    const result = await getRentedNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: true,
      data: rentedNumber,
    });
  });

  it('returns API errors', async () => {
    get.mockRejectedValue(new Error('404 Not Found: rented number does not exist'));

    const result = await getRentedNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      error: '404 Not Found: rented number does not exist',
    });
  });

  it('returns the credential guard response without calling the API', async () => {
    const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
    jest.mocked(numbersServiceHelper.getNumbersService).mockReturnValue(guard);

    const result = await getRentedNumberConfigurationHandler({ phoneNumber: PHONE_NUMBER });

    expect(result).toBe(guard.promptResponse);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('GetRentedNumberConfigurationSchema', () => {
  const schema = z.object(GetRentedNumberConfigurationSchema);

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
