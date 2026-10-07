import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { buildTtsBatchRequest } from './utils/builders/tts-batch-builder';
import { getVoiceV2Client } from './utils/voice-v2-client';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const MAX_DESTINATIONS = 500;
const DEFAULT_VOICE_NAME = 'Emma';
const DEFAULT_DIAL_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_CALL_DURATION_SECONDS = 300;
const TOOL_KEY: VoiceToolKey = 'createTtsBatch';
const TOOL_NAME = getToolName(TOOL_KEY);

export const CreateTtsBatchSchema = {
  from: z
    .string()
    .regex(E164_PATTERN)
    .describe('The active Sinch Voice origin number in E.164 format, for example +14155550100'),
  destinations: z
    .array(z.string().regex(E164_PATTERN))
    .min(1)
    .max(MAX_DESTINATIONS)
    .describe(
      `Destination numbers in E.164 format. This tool accepts at most ${MAX_DESTINATIONS} recipients per request to keep MCP payloads manageable.`,
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
  maxCps: z.number().int().min(1).max(1000).optional().describe('Maximum batch initiation rate in calls per second'),
  ttlSeconds: z
    .number()
    .int()
    .min(1)
    .max(10800)
    .optional()
    .describe('Seconds the platform may keep attempting to initiate queued calls'),
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
        `Accepts 1-${MAX_DESTINATIONS} E.164 destinations; the origin must be an active Sinch number with Voice capability.`,
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
  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const { voice } = maybeClient;

  try {
    const response = await voice.batches.start(
      buildTtsBatchRequest({
        from,
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
        origin: from,
        recipient_count: destinations.length,
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
