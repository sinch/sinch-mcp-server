import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
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
}: SetVoiceServiceWebhook): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const service = await voice.services.update({
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
  });
