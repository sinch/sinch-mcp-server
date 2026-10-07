import { listCallsHandler } from '../../../src/tools/voice/list-calls';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const listCalls = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    calls: { list: listCalls },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
});

test('listCallsHandler forwards filters and converts datetimes for the Voice API v2 SDK', async () => {
  const calls = [{ callId: '01AN4Z07BY79KA1307SR9X4MV3', callResult: 'COMPLETED' }];
  listCalls.mockResolvedValue({
    data: calls,
    hasNextPage: true,
    nextPageValue: '/v2/projects/project-id/calls?page=3',
    nextPage: jest.fn(),
  });

  const result = await listCallsHandler({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    from: '+14155550100',
    to: '+14155550123',
    callType: 'PHONE',
    startTime: '2026-10-01T00:00:00Z',
    endTime: '2026-10-07T12:00:00+02:00',
    callResult: 'COMPLETED',
    callReason: 'OK',
    page: 2,
    pageSize: 25,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(listCalls).toHaveBeenCalledWith({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    from: '+14155550100',
    to: '+14155550123',
    callType: 'PHONE',
    startTime: new Date('2026-10-01T00:00:00Z'),
    endTime: new Date('2026-10-07T12:00:00+02:00'),
    callResult: 'COMPLETED',
    callReason: 'OK',
    page: 2,
    pageSize: 25,
  });
  expect(parsed).toEqual({
    success: true,
    calls,
    pagination: {
      page: 2,
      page_size: 25,
      returned_count: 1,
      has_next_page: true,
      next_page: 3,
      next_page_value: '/v2/projects/project-id/calls?page=3',
    },
  });
});

test('listCallsHandler returns terminal-page metadata with default first page', async () => {
  listCalls.mockResolvedValue({
    data: [],
    hasNextPage: false,
    nextPageValue: '',
    nextPage: jest.fn(),
  });

  const result = await listCallsHandler({});
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: true,
    calls: [],
    pagination: {
      page: 1,
      returned_count: 0,
      has_next_page: false,
      next_page: null,
      next_page_value: null,
    },
  });
});

test('listCallsHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await listCallsHandler({});

  expect(result).toBe(guard.promptResponse);
  expect(listCalls).not.toHaveBeenCalled();
});

test('listCallsHandler returns API errors as failures', async () => {
  listCalls.mockRejectedValue(new Error('Unable to list calls'));

  const result = await listCallsHandler({});
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Unable to list calls',
  });
});
