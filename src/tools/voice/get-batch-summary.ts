import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

const BATCH_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const TOOL_KEY: VoiceToolKey = 'getBatchSummary';
const TOOL_NAME = getToolName(TOOL_KEY);

const GetBatchSummarySchema = {
  batchId: z.string().trim().regex(BATCH_ID_PATTERN).describe('The ULID returned when the voice batch was created'),
  includeSessionDetails: z
    .boolean()
    .optional()
    .describe('Also return each initiated session ID and its current state. Defaults to false.'),
};

type GetBatchSummary = z.infer<z.ZodObject<typeof GetBatchSummarySchema>>;

export const registerGetBatchSummary = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get the execution summary for an outbound voice-call batch. Optionally include the ID and state of each initiated session.',
      inputSchema: GetBatchSummarySchema,
    },
    getBatchSummaryHandler,
  );
};

export const getBatchSummaryHandler = async ({
  batchId,
  includeSessionDetails,
}: GetBatchSummary): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const [summary, details] = await Promise.all([
      voice.batches.get({ batchId }),
      includeSessionDetails ? voice.batches.getDetails({ batchId }) : Promise.resolve(undefined),
    ]);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        batch_summary: summary,
        ...(details ? { session_details: details.sessions } : {}),
      }),
    ).promptResponse;
  });
