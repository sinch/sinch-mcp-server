import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

export const CreateVoiceServiceSchema = {
  name: z.string().trim().min(1).describe('The Voice service name'),
  description: z.string().trim().min(1).optional().describe('An optional description of the Voice service'),
  isDefault: z.literal(true).optional().describe('Set to true to make this the project default Voice service'),
};

type CreateVoiceService = z.infer<z.ZodObject<typeof CreateVoiceServiceSchema>>;

const TOOL_KEY: VoiceToolKey = 'createVoiceService';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateVoiceService = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description: 'Create a Voice service. Optionally add a description or make it the project default.',
      inputSchema: CreateVoiceServiceSchema,
    },
    createVoiceServiceHandler,
  );
};

export const createVoiceServiceHandler = async ({
  name,
  description,
  isDefault,
}: CreateVoiceService): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const service = await voice.services.create({
      createServiceRequestBody: {
        name,
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        service,
      }),
    ).promptResponse;
  });
