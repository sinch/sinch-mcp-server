import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { env } from '../../env';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { buildTtsCallRequest } from './utils/builders/tts-call-builder';
import { E164_PATTERN } from './utils/phone-number';
import {
  DEFAULT_DIAL_TIMEOUT_SECONDS,
  DEFAULT_MAX_CALL_DURATION_SECONDS,
  DEFAULT_VOICE_NAME,
} from './utils/tts-call-defaults';
import { TtsCallOptionsSchema } from './utils/tts-call-schema';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';

const TtsCalloutSchema = {
  phoneNumber: z
    .string()
    .regex(E164_PATTERN)
    .describe('The destination phone number in E.164 format, for example +14155550123'),
  ...TtsCallOptionsSchema,
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
        'Place an outbound voice call that speaks a text-to-speech message when answered. Use when the user wants to call a phone number and say something aloud. Do NOT use send-text-message for this. Requires phoneNumber and message; the caller ID is optional.',
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
  if (origin !== undefined && !E164_PATTERN.test(origin)) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: 'The origin phone number must use E.164 format, for example +14155550100.',
      }),
    ).promptResponse;
  }

  return runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
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
  });
};
