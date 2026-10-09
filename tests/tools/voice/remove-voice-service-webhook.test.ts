import {
  RemoveVoiceServiceWebhookSchema,
  removeVoiceServiceWebhookHandler,
} from '../../../src/tools/voice/remove-voice-service-webhook';
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

test('removeVoiceServiceWebhookHandler sets call behavior to NONE', async () => {
  const serviceId = '6e124178-c29d-46a5-943c-5c2ae544aade';
  const service = {
    id: serviceId,
    name: 'Support',
    callBehavior: {
      type: 'NONE',
    },
  };
  updateService.mockResolvedValue(service);

  const result = await removeVoiceServiceWebhookHandler({ serviceId });
  const parsed = JSON.parse(result.content[0].text);

  expect(updateService).toHaveBeenCalledWith({
    serviceId,
    updateServiceRequestBody: {
      callBehavior: {
        type: 'NONE',
      },
    },
  });
  expect(parsed).toEqual({
    success: true,
    service,
  });
});

test('removeVoiceServiceWebhookHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await removeVoiceServiceWebhookHandler({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
  });

  expect(result).toBe(guard.promptResponse);
  expect(updateService).not.toHaveBeenCalled();
});

test('removeVoiceServiceWebhookHandler returns API errors as failures', async () => {
  updateService.mockRejectedValue(new Error('Service not found'));

  const result = await removeVoiceServiceWebhookHandler({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Service not found',
  });
});

test('RemoveVoiceServiceWebhookSchema validates the service ID', () => {
  const schema = z.object(RemoveVoiceServiceWebhookSchema);

  expect(schema.safeParse({ serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade' }).success).toBeTrue();
  expect(schema.safeParse({ serviceId: 'not-a-uuid' }).success).toBeFalse();
});
