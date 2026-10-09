import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

const CALL_TYPES = ['PHONE', 'SIP', 'STREAM', 'VOICE_RELAY'] as const;
const CALL_RESULTS = [
  'QUEUED',
  'INITIATED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'NO_ANSWER',
  'CANCEL',
  'BUSY',
  'FAILED',
] as const;
const CALL_REASONS = [
  'OK',
  'NOT_AVAILABLE',
  'CALLER_HANGUP',
  'CALLEE_HANGUP',
  'MANAGER_HANGUP',
  'DID_NOT_FOUND',
  'INVALID_SCRIPT',
  'UNKNOWN_PRODUCT',
  'NO_MORE_ROUTES',
  'ERROR',
] as const;

const ListCallsSchema = {
  serviceId: z.string().uuid().optional().describe('Only include calls for this Voice service ID'),
  from: z.string().trim().min(1).optional().describe('Only include calls from this origin'),
  to: z.string().trim().min(1).optional().describe('Only include calls to this destination'),
  callType: z.enum(CALL_TYPES).optional().describe('Only include calls using this channel type'),
  startTime: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe('Only include calls started at or after this ISO 8601 datetime'),
  endTime: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe('Only include calls ended before this ISO 8601 datetime'),
  callResult: z.enum(CALL_RESULTS).optional().describe('Only include calls with this result'),
  callReason: z.enum(CALL_REASONS).optional().describe('Only include calls with this completion reason'),
  page: z.number().int().min(1).optional().describe('The 1-based page number to return'),
  pageSize: z.number().int().min(1).optional().describe('The number of calls to return on this page'),
};

type ListCalls = z.infer<z.ZodObject<typeof ListCallsSchema>>;

const TOOL_KEY: VoiceToolKey = 'listCalls';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListCalls = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'List and filter voice call legs by service, endpoints, channel, time range, result, or reason. Results are returned one page at a time with pagination metadata.',
      inputSchema: ListCallsSchema,
    },
    listCallsHandler,
  );
};

export const listCallsHandler = async ({
  serviceId,
  from,
  to,
  callType,
  startTime,
  endTime,
  callResult,
  callReason,
  page,
  pageSize,
}: ListCalls): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const response = await voice.calls.list({
      serviceId,
      from,
      to,
      callType,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      callResult,
      callReason,
      page,
      pageSize,
    });
    const currentPage = page ?? 1;

    return new PromptResponse(
      JSON.stringify({
        success: true,
        calls: response.data,
        pagination: {
          page: currentPage,
          page_size: pageSize,
          returned_count: response.data.length,
          has_next_page: response.hasNextPage,
          next_page: response.hasNextPage ? currentPage + 1 : null,
        },
      }),
    ).promptResponse;
  });
