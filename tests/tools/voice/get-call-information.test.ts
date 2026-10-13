import { getCallInformationHandler } from '../../../src/tools/voice/get-call-information';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const getCall = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    calls: { get: getCall },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
});

test('getCallInformationHandler returns Voice API v2 call details', async () => {
  const call = {
    callId: '01AN4Z07BY79KA1307SR9X4MV3',
    projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
    startTime: '2026-10-07T07:00:00Z',
    callType: 'PHONE',
    direction: 'OUTBOUND',
    callResult: 'COMPLETED',
    originationType: 'SERVER',
    callRate: {
      currencyCode: 'USD',
      amount: '0.0123',
    },
    callResourceUrl: '/v2/projects/project-id/calls/01AN4Z07BY79KA1307SR9X4MV3',
  };
  getCall.mockResolvedValue(call);

  const result = await getCallInformationHandler({
    callId: '01AN4Z07BY79KA1307SR9X4MV3',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(getCall).toHaveBeenCalledWith({
    callId: '01AN4Z07BY79KA1307SR9X4MV3',
  });
  expect(parsed).toEqual({
    success: true,
    call_information: call,
  });
});

test('getCallInformationHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await getCallInformationHandler({
    callId: '01AN4Z07BY79KA1307SR9X4MV3',
  });

  expect(result).toBe(guard.promptResponse);
  expect(getCall).not.toHaveBeenCalled();
});

test('getCallInformationHandler returns API errors as failures', async () => {
  getCall.mockRejectedValue(new Error('Call not found'));

  const result = await getCallInformationHandler({
    callId: '01AN4Z07BY79KA1307SR9X4MV3',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Call not found',
  });
});
