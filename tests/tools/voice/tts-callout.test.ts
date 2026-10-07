import { ttsCalloutHandler } from '../../../src/tools/voice/tts-callout';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';
import { mockEnv, resetMockEnv } from '../../helpers/mock-env';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const PROJECT_ID = '5c5bf2b1-35ae-4825-ab89-457e07bb60e6';
const SERVICE_ID = '6e124178-c29d-46a5-943c-5c2ae544aade';
const ORIGIN = '+14045001000';
const DESTINATION = '+14155550123';

const startCall = jest.fn();
const client = {
  projectId: PROJECT_ID,
  numbers: {},
  voice: {
    calls: { start: startCall },
  },
} as unknown as VoiceV2Client;

const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  resetMockEnv();
  mockEnv.CALLING_LINE_IDENTIFICATION = ORIGIN;
  mockedGetVoiceV2Client.mockReturnValue(client);
  startCall.mockResolvedValue({
    projectId: PROJECT_ID,
    serviceId: SERVICE_ID,
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });
});

test('ttsCalloutHandler lets the API use the default service when none is selected', async () => {
  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Your appointment is tomorrow.',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(startCall).toHaveBeenCalledWith({
    createCallRequestBody: expect.objectContaining({
      commands: expect.any(Array),
    }),
  });
  expect(parsed).toEqual({
    success: true,
    session_id: '01BX5ZZKBKACTAV9WEVGEMMVRB',
    service_id: SERVICE_ID,
    origin: ORIGIN,
    destination: DESTINATION,
  });
});

test('ttsCalloutHandler forwards an explicitly selected service without preflight requests', async () => {
  await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: '<speak>Hello</speak>',
    from: ORIGIN,
    serviceId: SERVICE_ID,
    voiceName: 'Amy',
    format: 'SSML',
    dialTimeoutSeconds: 20,
    maxCallDurationSeconds: 60,
  });

  expect(startCall).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceId: SERVICE_ID,
      createCallRequestBody: expect.objectContaining({
        commands: expect.any(Array),
      }),
    }),
  );
});

test('ttsCalloutHandler returns call API errors as failures', async () => {
  startCall.mockRejectedValue(new Error('The origin number is not configured for the selected service'));

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin number is not configured for the selected service',
  });
});

test('ttsCalloutHandler fails clearly when no origin is configured', async () => {
  delete mockEnv.CALLING_LINE_IDENTIFICATION;

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeFalse();
  expect(parsed.error).toContain('Missing origin phone number');
  expect(mockedGetVoiceV2Client).not.toHaveBeenCalled();
});

test('ttsCalloutHandler returns the credential guard response', async () => {
  const guard = new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
  mockedGetVoiceV2Client.mockReturnValue(guard);

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });

  expect(result).toBe(guard.promptResponse);
  expect(startCall).not.toHaveBeenCalled();
});
