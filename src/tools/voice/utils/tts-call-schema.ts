import { z } from 'zod';
import { E164_PATTERN } from './phone-number';
import {
  DEFAULT_DIAL_TIMEOUT_SECONDS,
  DEFAULT_MAX_CALL_DURATION_SECONDS,
  DEFAULT_VOICE_NAME,
} from './tts-call-defaults';

export const TtsCallOptionsSchema = {
  from: z
    .string()
    .regex(E164_PATTERN)
    .optional()
    .describe(
      'The active Sinch Voice number to call from, in E.164 format. Uses CALLING_LINE_IDENTIFICATION when omitted; if neither is set, the call has no caller ID.',
    ),
  message: z.string().trim().min(1).max(600).describe('The text or SSML message to read on every answered call'),
  voiceName: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(`The Sinch TTS voice name. Defaults to ${DEFAULT_VOICE_NAME}.`),
  format: z.enum(['TEXT', 'SSML']).optional().describe('The message format. Defaults to TEXT.'),
  serviceId: z
    .string()
    .uuid()
    .optional()
    .describe('The Voice service ID. Uses the project default service when omitted.'),
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
