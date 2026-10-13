import { getBatchSummaryHandler } from '../../../src/tools/voice/get-batch-summary';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const BATCH_ID = '01BX5ZZKBKACTAV9WEVGEMMVRB';
const getBatch = jest.fn();
const getBatchDetails = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    batches: {
      get: getBatch,
      getDetails: getBatchDetails,
    },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
  getBatch.mockResolvedValue({
    batchId: BATCH_ID,
    sessionCount: 2,
    queued: 0,
    inProgress: 1,
    completed: 1,
    expired: 0,
    requestedCps: 10,
    ttlSeconds: 300,
  });
});

test('getBatchSummaryHandler returns the Voice API v2 batch summary', async () => {
  const result = await getBatchSummaryHandler({ batchId: BATCH_ID });
  const parsed = JSON.parse(result.content[0].text);

  expect(getBatch).toHaveBeenCalledWith({ batchId: BATCH_ID });
  expect(getBatchDetails).not.toHaveBeenCalled();
  expect(parsed).toEqual({
    success: true,
    batch_summary: {
      batchId: BATCH_ID,
      sessionCount: 2,
      queued: 0,
      inProgress: 1,
      completed: 1,
      expired: 0,
      requestedCps: 10,
      ttlSeconds: 300,
    },
  });
});

test('getBatchSummaryHandler optionally returns per-session details', async () => {
  const sessions = [
    { id: '01AN4Z07BY79KA1307SR9X4MV3', state: 'COMPLETED' },
    { id: '01AN4Z07BY79KA1307SR9X4MV4', state: 'IN_PROGRESS' },
  ];
  getBatchDetails.mockResolvedValue({ sessions });
  getBatch.mockImplementationOnce(async () => {
    await Promise.resolve();
    expect(getBatchDetails).toHaveBeenCalledWith({ batchId: BATCH_ID });
    return { batchId: BATCH_ID };
  });

  const result = await getBatchSummaryHandler({
    batchId: BATCH_ID,
    includeSessionDetails: true,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(getBatchDetails).toHaveBeenCalledWith({ batchId: BATCH_ID });
  expect(parsed.success).toBeTrue();
  expect(parsed.session_details).toEqual(sessions);
});

test('getBatchSummaryHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await getBatchSummaryHandler({ batchId: BATCH_ID });

  expect(result).toBe(guard.promptResponse);
  expect(getBatch).not.toHaveBeenCalled();
});

test('getBatchSummaryHandler returns API errors as failures', async () => {
  getBatch.mockRejectedValue(new Error('Batch not found'));

  const result = await getBatchSummaryHandler({ batchId: BATCH_ID });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Batch not found',
  });
  expect(getBatchDetails).not.toHaveBeenCalled();
});
