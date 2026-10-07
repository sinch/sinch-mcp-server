import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getVoiceV2Client } from './utils/voice-v2-client';
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
}: RemoveVoiceServiceWebhook): Promise<IPromptResponse> => {
  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    const service = await maybeClient.voice.services.update({
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
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }
};
