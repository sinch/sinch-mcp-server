import { ttsCalloutHandler } from '../../../src/tools/voice/tts-callout';
import { getVoiceV2Client, VoiceV2Client } from '../../../src/tools/voice/utils/voice-v2-client';
import { PromptResponse } from '../../../src/types';
import { mockEnv, resetMockEnv } from '../../helpers/mock-env';

jest.mock('../../../src/tools/voice/utils/voice-v2-client');

const PROJECT_ID = '5c5bf2b1-35ae-4825-ab89-457e07bb60e6';
const SERVICE_ID = '6e124178-c29d-46a5-943c-5c2ae544aade';
const ORIGIN = '+14045001000';
const DESTINATION = '+14155550123';

const getActiveNumber = jest.fn();
const getService = jest.fn();
const listServices = jest.fn();
const startCall = jest.fn();
const client = {
  projectId: PROJECT_ID,
  numbers: { get: getActiveNumber },
  voice: {
    calls: { start: startCall },
    services: { get: getService, list: listServices },
  },
} as unknown as VoiceV2Client;

const mockedGetVoiceV2Client = jest.mocked(getVoiceV2Client);

beforeEach(() => {
  jest.clearAllMocks();
  resetMockEnv();
  mockEnv.CALLING_LINE_IDENTIFICATION = ORIGIN;
  mockedGetVoiceV2Client.mockReturnValue(client);
  getActiveNumber.mockResolvedValue({
    phoneNumber: ORIGIN,
    projectId: PROJECT_ID,
    capability: ['VOICE'],
  });
  listServices.mockResolvedValue({
    data: [
      {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        name: 'Default',
        isDefault: true,
      },
    ],
  });
  startCall.mockResolvedValue({
    projectId: PROJECT_ID,
    serviceId: SERVICE_ID,
    sessionId: '01BX5ZZKBKACTAV9WEVGEMMVRB',
  });
});

test('ttsCalloutHandler validates the origin and creates a Voice API v2 TTS call', async () => {
  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Your appointment is tomorrow.',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(getActiveNumber).toHaveBeenCalledWith({ phoneNumber: ORIGIN });
  expect(listServices).toHaveBeenCalledWith({ isDefault: true, pageSize: 1 });
  expect(startCall).toHaveBeenCalledWith({
    serviceId: SERVICE_ID,
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

test('ttsCalloutHandler validates an explicitly selected service', async () => {
  getService.mockResolvedValue({
    serviceId: SERVICE_ID,
    projectId: PROJECT_ID,
    name: 'Selected',
    isDefault: false,
  });

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

  expect(getService).toHaveBeenCalledWith({ serviceId: SERVICE_ID });
  expect(listServices).not.toHaveBeenCalled();
  expect(startCall).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceId: SERVICE_ID,
      createCallRequestBody: expect.objectContaining({
        commands: expect.any(Array),
      }),
    }),
  );
});

test('ttsCalloutHandler rejects an origin without Voice capability', async () => {
  getActiveNumber.mockResolvedValue({
    phoneNumber: ORIGIN,
    projectId: PROJECT_ID,
    capability: ['SMS'],
  });

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin phone number is not enabled for Voice.',
  });
  expect(startCall).not.toHaveBeenCalled();
});

test('ttsCalloutHandler rejects an origin from another project', async () => {
  getActiveNumber.mockResolvedValue({
    phoneNumber: ORIGIN,
    projectId: 'another-project',
    capability: ['VOICE'],
  });

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin phone number does not belong to the authenticated project.',
  });
  expect(startCall).not.toHaveBeenCalled();
});

test('ttsCalloutHandler rejects an origin whose Voice provisioning is not ready', async () => {
  getActiveNumber.mockResolvedValue({
    phoneNumber: ORIGIN,
    projectId: PROJECT_ID,
    capability: ['VOICE'],
    voiceConfiguration: {
      type: 'RTC',
      scheduledVoiceProvisioning: {
        status: 'IN_PROGRESS',
      },
    },
  });

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'The origin phone number Voice provisioning is not ready: IN_PROGRESS.',
  });
  expect(startCall).not.toHaveBeenCalled();
});

test('ttsCalloutHandler fails when the project has no default Voice service', async () => {
  listServices.mockResolvedValue({ data: [] });

  const result = await ttsCalloutHandler({
    phoneNumber: DESTINATION,
    message: 'Hello',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'No default Voice service is configured for the authenticated project.',
  });
  expect(startCall).not.toHaveBeenCalled();
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
  expect(getActiveNumber).not.toHaveBeenCalled();
});
