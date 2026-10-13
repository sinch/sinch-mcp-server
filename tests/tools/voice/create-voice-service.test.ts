import { CreateVoiceServiceSchema, createVoiceServiceHandler } from '../../../src/tools/voice/create-voice-service';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';
import { z } from 'zod';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const createService = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    services: { create: createService },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
});

test('createVoiceServiceHandler creates a service without supplying an idempotency key', async () => {
  const service = {
    id: '6e124178-c29d-46a5-943c-5c2ae544aade',
    name: 'Support',
    description: 'Support calls',
    isDefault: true,
  };
  createService.mockResolvedValue(service);

  const result = await createVoiceServiceHandler({
    name: 'Support',
    description: 'Support calls',
    isDefault: true,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(createService).toHaveBeenCalledWith({
    createServiceRequestBody: {
      name: 'Support',
      description: 'Support calls',
      isDefault: true,
    },
  });
  expect(parsed).toEqual({
    success: true,
    service,
  });
});

test('createVoiceServiceHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await createVoiceServiceHandler({ name: 'Support' });

  expect(result).toBe(guard.promptResponse);
  expect(createService).not.toHaveBeenCalled();
});

test('createVoiceServiceHandler returns API errors as failures', async () => {
  createService.mockRejectedValue(new Error('Service name already exists'));

  const result = await createVoiceServiceHandler({ name: 'Support' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Service name already exists',
  });
});

test('CreateVoiceServiceSchema only accepts true for isDefault', () => {
  const schema = z.object(CreateVoiceServiceSchema);

  expect(schema.safeParse({ name: 'Support', isDefault: true }).success).toBeTrue();
  expect(schema.safeParse({ name: 'Support', isDefault: false }).success).toBeFalse();
});
