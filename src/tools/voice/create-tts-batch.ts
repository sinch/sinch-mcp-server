import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { buildTtsBatchRequest } from './utils/builders/tts-batch-builder';
import { E164_PATTERN } from './utils/phone-number';
import {
  DEFAULT_DIAL_TIMEOUT_SECONDS,
  DEFAULT_MAX_CALL_DURATION_SECONDS,
  DEFAULT_VOICE_NAME,
} from './utils/tts-call-defaults';
import { TtsCallOptionsSchema } from './utils/tts-call-schema';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { env } from '../../env';

const MAX_DESTINATIONS = 500;
const TOOL_KEY: VoiceToolKey = 'createTtsBatch';
const TOOL_NAME = getToolName(TOOL_KEY);

export const CreateTtsBatchSchema = {
  destinations: z
    .array(z.string().regex(E164_PATTERN))
    .min(1)
    .max(MAX_DESTINATIONS)
    .describe(
      `Destination numbers in E.164 format. This tool accepts at most ${MAX_DESTINATIONS} recipients per request to keep MCP payloads manageable.`,
    ),
  ...TtsCallOptionsSchema,
  maxCps: z.number().int().min(1).max(1000).optional().describe('Maximum batch initiation rate in calls per second'),
  ttlSeconds: z
    .number()
    .int()
    .min(1)
    .max(10800)
    .optional()
    .describe('Seconds the platform may keep attempting to initiate queued calls'),
};

type CreateTtsBatch = z.infer<z.ZodObject<typeof CreateTtsBatchSchema>>;

export const registerCreateTtsBatch = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        `Create a batch of outbound voice calls that all play the same text-to-speech message. ` +
        `Accepts 1-${MAX_DESTINATIONS} E.164 destinations; the caller ID is optional.`,
      inputSchema: CreateTtsBatchSchema,
    },
    createTtsBatchHandler,
  );
};

export const createTtsBatchHandler = async ({
  from,
  destinations,
  message,
  voiceName,
  format,
  serviceId,
  maxCps,
  ttlSeconds,
  dialTimeoutSeconds,
  maxCallDurationSeconds,
}: CreateTtsBatch): Promise<IPromptResponse> => {
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
    const response = await voice.batches.start(
      buildTtsBatchRequest({
        from: origin,
        destinations,
        message,
        serviceId,
        voiceName: voiceName ?? DEFAULT_VOICE_NAME,
        format: format ?? 'TEXT',
        dialTimeoutDurationSeconds: dialTimeoutSeconds ?? DEFAULT_DIAL_TIMEOUT_SECONDS,
        maxCallDurationSeconds: maxCallDurationSeconds ?? DEFAULT_MAX_CALL_DURATION_SECONDS,
        maxCps,
        ttlSeconds,
      }),
    );

    return new PromptResponse(
      JSON.stringify({
        success: true,
        batch_id: response.batchId,
        service_id: response.serviceId,
        origin,
        recipient_count: destinations.length,
      }),
    ).promptResponse;
  });
};
