import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { env } from '../../env';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceV2Client } from './utils/voice-v2-client';
import { buildTtsCallRequest } from './utils/builders/tts-call-builder';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const DEFAULT_VOICE_NAME = 'Emma';
const DEFAULT_DIAL_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_CALL_DURATION_SECONDS = 300;

const TtsCalloutSchema = {
  phoneNumber: z
    .string()
    .regex(E164_PATTERN)
    .describe('The destination phone number in E.164 format, for example +14155550123'),
  message: z.string().trim().min(1).max(600).describe('The text or SSML message to read out loud'),
  from: z
    .string()
    .regex(E164_PATTERN)
    .optional()
    .describe(
      'The active Sinch Voice number to call from, in E.164 format. Uses CALLING_LINE_IDENTIFICATION when omitted.',
    ),
  serviceId: z
    .string()
    .uuid()
    .optional()
    .describe('The Voice service ID. Uses the project default service when omitted.'),
  voiceName: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(`The Sinch TTS voice name. Defaults to ${DEFAULT_VOICE_NAME}.`),
  format: z.enum(['TEXT', 'SSML']).optional().describe('The message format. Defaults to TEXT.'),
  dialTimeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe(`Seconds to wait for an answer. Defaults to ${DEFAULT_DIAL_TIMEOUT_SECONDS}.`),
  maxCallDurationSeconds: z
    .number()
    .int()
    .min(1)
    .max(14400)
    .optional()
    .describe(`Maximum call duration in seconds. Defaults to ${DEFAULT_MAX_CALL_DURATION_SECONDS}.`),
};

type TtsCallout = z.infer<z.ZodObject<typeof TtsCalloutSchema>>;

const TOOL_KEY: VoiceToolKey = 'ttsCallout';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerTtsCallout = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Place an outbound voice call that speaks a text-to-speech message when answered. Use when the user wants to call a phone number and say something aloud. Do NOT use send-text-message for this. Requires phoneNumber and message; the origin must be an active Sinch number with Voice capability.',
      inputSchema: TtsCalloutSchema,
    },
    ttsCalloutHandler,
  );
};

export const ttsCalloutHandler = async ({
  phoneNumber,
  message,
  from,
  serviceId,
  voiceName,
  format,
  dialTimeoutSeconds,
  maxCallDurationSeconds,
}: TtsCallout): Promise<IPromptResponse> => {
  const origin = from ?? env.CALLING_LINE_IDENTIFICATION;
  if (!origin) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error:
          'Missing origin phone number. Provide "from" or set the CALLING_LINE_IDENTIFICATION environment variable.',
      }),
    ).promptResponse;
  }
  if (!E164_PATTERN.test(origin)) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: 'The origin phone number must use E.164 format, for example +14155550100.',
      }),
    ).promptResponse;
  }

  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const { voice } = maybeClient;

  try {
    const response = await voice.calls.start(
      buildTtsCallRequest({
        from: origin,
        to: phoneNumber,
        message,
        serviceId,
        voiceName: voiceName ?? DEFAULT_VOICE_NAME,
        format: format ?? 'TEXT',
        dialTimeoutDurationSeconds: dialTimeoutSeconds ?? DEFAULT_DIAL_TIMEOUT_SECONDS,
        maxCallDurationSeconds: maxCallDurationSeconds ?? DEFAULT_MAX_CALL_DURATION_SECONDS,
      }),
    );

    return new PromptResponse(
      JSON.stringify({
        success: true,
        session_id: response.sessionId,
        service_id: response.serviceId,
        origin,
        destination: phoneNumber,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }
};
