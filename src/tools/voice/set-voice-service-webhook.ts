import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getVoiceV2Client } from './utils/voice-v2-client';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

export const SetVoiceServiceWebhookSchema = {
  serviceId: z.string().uuid().describe('The UUID of the Voice service to update'),
  url: z
    .string()
    .url()
    .regex(/^https?:\/\//i)
    .describe('The primary HTTP(S) webhook URL for Voice events'),
  fallbackUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//i)
    .describe('The fallback HTTP(S) webhook URL'),
};

type SetVoiceServiceWebhook = z.infer<z.ZodObject<typeof SetVoiceServiceWebhookSchema>>;

const TOOL_KEY: VoiceToolKey = 'setVoiceServiceWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSetVoiceServiceWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Set the primary webhook URL and fallback URL for a Voice service. This replaces its current call behavior with webhook handling.',
      inputSchema: SetVoiceServiceWebhookSchema,
    },
    setVoiceServiceWebhookHandler,
  );
};

export const setVoiceServiceWebhookHandler = async ({
  serviceId,
  url,
  fallbackUrl,
}: SetVoiceServiceWebhook): Promise<IPromptResponse> => {
  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    const service = await maybeClient.voice.services.update({
      serviceId,
      updateServiceRequestBody: {
        callBehavior: {
          type: 'WEBHOOK',
          webhook: {
            url,
            fallbackUrl,
          },
        },
      },
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        service,
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
