import { getSessionInformationHandler } from '../../../src/tools/voice/get-session-information';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const getSession = jest.fn();
const client = {
  projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
  numbers: {},
  voice: {
    sessions: { get: getSession },
  },
} as unknown as VoiceV2Client;
const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetVoiceV2Client.mockReturnValue(client);
});

test('getSessionInformationHandler returns Voice API v2 session details', async () => {
  const session = {
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
    projectId: '5c5bf2b1-35ae-4825-ab89-457e07bb60e6',
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    calls: [{ callId: '01AN4Z07BY79KA1307SR9X4MV3', callResult: 'COMPLETED' }],
  };
  getSession.mockResolvedValue(session);

  const result = await getSessionInformationHandler({
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(getSession).toHaveBeenCalledWith({
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });
  expect(parsed).toEqual({
    success: true,
    session_information: session,
  });
});

test('getSessionInformationHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await getSessionInformationHandler({
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });

  expect(result).toBe(guard.promptResponse);
  expect(getSession).not.toHaveBeenCalled();
});

test('getSessionInformationHandler returns API errors as failures', async () => {
  getSession.mockRejectedValue(new Error('Session not found'));

  const result = await getSessionInformationHandler({
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'Session not found',
  });
});
