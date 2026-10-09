import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

export const RemoveVoiceServiceWebhookSchema = {
  serviceId: z.string().uuid().describe('The UUID of the Voice service whose webhook configuration should be removed'),
};

type RemoveVoiceServiceWebhook = z.infer<z.ZodObject<typeof RemoveVoiceServiceWebhookSchema>>;

const TOOL_KEY: VoiceToolKey = 'removeVoiceServiceWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerRemoveVoiceServiceWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description: 'Remove webhook configuration from a Voice service, leaving it with no incoming-call behavior.',
      inputSchema: RemoveVoiceServiceWebhookSchema,
    },
    removeVoiceServiceWebhookHandler,
  );
};

export const removeVoiceServiceWebhookHandler = async ({
  serviceId,
}: RemoveVoiceServiceWebhook): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const service = await voice.services.update({
      serviceId,
      updateServiceRequestBody: {
        callBehavior: {
          type: 'NONE',
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
