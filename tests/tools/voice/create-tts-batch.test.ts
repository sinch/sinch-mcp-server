import { z } from 'zod';
import { createTtsBatchHandler, CreateTtsBatchSchema } from '../../../src/tools/voice/create-tts-batch';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';
import { mockEnv, resetMockEnv } from '../../helpers/mock-env';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const PROJECT_ID = '5c5bf2b1-35ae-4825-ab89-457e07bb60e6';
const SERVICE_ID = '6e124178-c29d-46a5-943c-5c2ae544aade';
const BATCH_ID = '01BX5ZZKBKACTAV9WEVGEMMVRB';
const ORIGIN = '+14045001000';
const DESTINATIONS = ['+14155550123', '+14155550124'];

const startBatch = jest.fn();
const client = {
  projectId: PROJECT_ID,
  numbers: {},
  voice: {
    batches: { start: startBatch },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  resetMockEnv();
  mockEnv.CALLING_LINE_IDENTIFICATION = ORIGIN;
  mockedGetVoiceV2Client.mockReturnValue(client);
  startBatch.mockResolvedValue({
    projectId: PROJECT_ID,
    serviceId: SERVICE_ID,
    batchId: BATCH_ID,
  });
});

test('createTtsBatchHandler lets the API use the default service when none is selected', async () => {
  const result = await createTtsBatchHandler({
    destinations: DESTINATIONS,
    message: 'Your appointment is tomorrow.',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(startBatch).toHaveBeenCalledWith({
    startBatchRequestBody: expect.objectContaining({
      commands: expect.any(Array),
      parameters: [
        { from: ORIGIN, to: DESTINATIONS[0] },
        { from: ORIGIN, to: DESTINATIONS[1] },
      ],
    }),
  });
  expect(startBatch.mock.calls[0][0]).not.toHaveProperty('Idempotency-Key');
  expect(parsed).toEqual({
    success: true,
    batch_id: BATCH_ID,
    service_id: SERVICE_ID,
    origin: ORIGIN,
    recipient_count: 2,
  });
});

test('createTtsBatchHandler passes optional settings and an explicit service without preflight requests', async () => {
  await createTtsBatchHandler({
    from: ORIGIN,
    destinations: [DESTINATIONS[0]],
    message: '<speak>Hello</speak>',
    serviceId: SERVICE_ID,
    voiceName: 'Amy',
    format: 'SSML',
    maxCps: 25,
    ttlSeconds: 600,
    dialTimeoutSeconds: 20,
    maxCallDurationSeconds: 60,
  });

  expect(startBatch).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceId: SERVICE_ID,
      startBatchRequestBody: expect.objectContaining({
        batchOptions: { maxCps: 25, ttlSeconds: 600 },
      }),
    }),
  );
});

test('createTtsBatchHandler returns batch API errors as failures', async () => {
  startBatch.mockRejectedValue(new Error('The origin number is not configured for the selected service'));

  const result = await createTtsBatchHandler({
    from: ORIGIN,
    destinations: DESTINATIONS,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin number is not configured for the selected service',
  });
});

test('createTtsBatchHandler omits caller ID when no origin is provided or configured', async () => {
  delete mockEnv.CALLING_LINE_IDENTIFICATION;

  const result = await createTtsBatchHandler({
    destinations: DESTINATIONS,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  const requestBody = startBatch.mock.calls[0][0].startBatchRequestBody;
  expect(requestBody.commands[0]).not.toHaveProperty('from');
  expect(requestBody.parameters).toEqual([{ to: DESTINATIONS[0] }, { to: DESTINATIONS[1] }]);
  expect(parsed).toEqual({
    success: true,
    batch_id: BATCH_ID,
    service_id: SERVICE_ID,
    recipient_count: 2,
  });
});

test('createTtsBatchHandler rejects an invalid configured origin', async () => {
  mockEnv.CALLING_LINE_IDENTIFICATION = 'invalid-number';

  const result = await createTtsBatchHandler({
    destinations: DESTINATIONS,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin phone number must use E.164 format, for example +14155550100.',
  });
  expect(mockedGetVoiceV2Client).not.toHaveBeenCalled();
});

test('createTtsBatchHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await createTtsBatchHandler({
    from: ORIGIN,
    destinations: DESTINATIONS,
    message: 'Hello',
  });

  expect(result).toBe(guard.promptResponse);
  expect(startBatch).not.toHaveBeenCalled();
});

test('CreateTtsBatchSchema bounds recipient count and batch options', () => {
  const schema = z.object(CreateTtsBatchSchema);
  const base = { from: ORIGIN, message: 'Hello' };

  expect(schema.safeParse({ ...base, destinations: [] }).success).toBeFalse();
  expect(schema.safeParse({ ...base, destinations: Array(501).fill(DESTINATIONS[0]) }).success).toBeFalse();
  expect(schema.safeParse({ ...base, destinations: DESTINATIONS, maxCps: 1001 }).success).toBeFalse();
  expect(schema.safeParse({ ...base, destinations: DESTINATIONS, ttlSeconds: 10801 }).success).toBeFalse();
  expect(schema.safeParse({ ...base, destinations: DESTINATIONS, maxCps: 1000, ttlSeconds: 10800 }).success).toBeTrue();
});
