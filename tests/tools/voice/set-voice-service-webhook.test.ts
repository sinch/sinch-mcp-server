import {
  SetVoiceServiceWebhookSchema,
  setVoiceServiceWebhookHandler,
} from '../../../src/tools/voice/set-voice-service-webhook';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';
import { z } from 'zod';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const updateService = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    services: { update: updateService },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
});

test('setVoiceServiceWebhookHandler configures primary and fallback webhook URLs', async () => {
  const serviceId = '6e124178-c29d-46a5-943c-5c2ae544aade';
  const service = {
    id: serviceId,
    name: 'Support',
    callBehavior: {
      type: 'WEBHOOK',
      webhook: {
        url: 'https://example.com/voice',
        fallbackUrl: 'https://fallback.example.com/voice',
      },
    },
  };
  updateService.mockResolvedValue(service);

  const result = await setVoiceServiceWebhookHandler({
    serviceId,
    url: 'https://example.com/voice',
    fallbackUrl: 'https://fallback.example.com/voice',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(updateService).toHaveBeenCalledWith({
    serviceId,
    updateServiceRequestBody: {
      callBehavior: {
        type: 'WEBHOOK',
        webhook: {
          url: 'https://example.com/voice',
          fallbackUrl: 'https://fallback.example.com/voice',
        },
      },
    },
  });
  expect(parsed).toEqual({
    success: true,
    service,
  });
});

test('setVoiceServiceWebhookHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await setVoiceServiceWebhookHandler({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    url: 'https://example.com/voice',
    fallbackUrl: 'https://fallback.example.com/voice',
  });

  expect(result).toBe(guard.promptResponse);
  expect(updateService).not.toHaveBeenCalled();
});

test('setVoiceServiceWebhookHandler returns API errors as failures', async () => {
  updateService.mockRejectedValue(new Error('Service not found'));

  const result = await setVoiceServiceWebhookHandler({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    url: 'https://example.com/voice',
    fallbackUrl: 'https://fallback.example.com/voice',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Service not found',
  });
});

test('SetVoiceServiceWebhookSchema validates service IDs and URLs', () => {
  const schema = z.object(SetVoiceServiceWebhookSchema);

  expect(
    schema.safeParse({
      serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
      url: 'https://example.com/voice',
      fallbackUrl: 'https://fallback.example.com/voice',
    }).success,
  ).toBeTrue();
  expect(
    schema.safeParse({
      serviceId: 'not-a-uuid',
      url: 'https://example.com/voice',
      fallbackUrl: 'https://fallback.example.com/voice',
    }).success,
  ).toBeFalse();
  expect(
    schema.safeParse({
      serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
      url: 'not-a-url',
      fallbackUrl: 'https://fallback.example.com/voice',
    }).success,
  ).toBeFalse();
  expect(
    schema.safeParse({
      serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
      url: 'ftp://example.com/voice',
      fallbackUrl: 'https://fallback.example.com/voice',
    }).success,
  ).toBeFalse();
  expect(
    schema.safeParse({
      serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
      url: 'https://example.com/voice',
    }).success,
  ).toBeFalse();
});
