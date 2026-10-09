import { z } from 'zod';
import {
  AssignNumberToVoiceServiceSchema,
  assignNumberToVoiceServiceHandler,
} from '../../../src/tools/voice/assign-number-to-voice-service';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const PROJECT_ID = '5c5bf2b1-35ae-4825-ab89-457e07bb60e6';
const SERVICE_ID = '6e124178-c29d-46a5-943c-5c2ae544aade';
const PHONE_NUMBER = '+14155550100';

const updateNumber = jest.fn();
const client = {
  projectId: PROJECT_ID,
  numbers: {
    update: updateNumber,
  },
  voice: {},
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
  updateNumber.mockResolvedValue({
    phoneNumber: PHONE_NUMBER,
    voiceConfiguration: {
      type: 'RTC',
      appId: SERVICE_ID,
    },
  });
});

test('assignNumberToVoiceServiceHandler validates and assigns the active number', async () => {
  const result = await assignNumberToVoiceServiceHandler({
    phoneNumber: PHONE_NUMBER,
    serviceId: SERVICE_ID,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(updateNumber).toHaveBeenCalledWith({
    phoneNumber: PHONE_NUMBER,
    updateActiveNumberRequestBody: {
      voiceConfiguration: {
        type: 'RTC',
        appId: SERVICE_ID,
      },
    },
  });
  expect(parsed).toEqual({
    success: true,
    phone_number: PHONE_NUMBER,
    service_id: SERVICE_ID,
    voice_configuration: {
      type: 'RTC',
      appId: SERVICE_ID,
    },
  });
});

test('assignNumberToVoiceServiceHandler returns Numbers API errors as failures', async () => {
  updateNumber.mockRejectedValue(new Error('The number cannot be configured for Voice'));

  const result = await assignNumberToVoiceServiceHandler({
    phoneNumber: PHONE_NUMBER,
    serviceId: SERVICE_ID,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The number cannot be configured for Voice',
  });
});

test('assignNumberToVoiceServiceHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await assignNumberToVoiceServiceHandler({
    phoneNumber: PHONE_NUMBER,
    serviceId: SERVICE_ID,
  });

  expect(result).toBe(guard.promptResponse);
  expect(updateNumber).not.toHaveBeenCalled();
});

test('AssignNumberToVoiceServiceSchema validates E.164 numbers and service UUIDs', () => {
  const schema = z.object(AssignNumberToVoiceServiceSchema);

  expect(schema.safeParse({ phoneNumber: PHONE_NUMBER, serviceId: SERVICE_ID }).success).toBeTrue();
  expect(schema.safeParse({ phoneNumber: '4155550100', serviceId: SERVICE_ID }).success).toBeFalse();
  expect(schema.safeParse({ phoneNumber: PHONE_NUMBER, serviceId: 'not-a-uuid' }).success).toBeFalse();
});
