import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsPageToken } from './prompt-schemas';
import { formatRcsSenderSummary } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const ListRcsSendersSchema = {
  pageToken: RcsPageToken,
};

type ListRcsSenders = z.infer<z.ZodObject<typeof ListRcsSendersSchema>>;

const TOOL_KEY: RcsToolKey = 'listRcsSenders';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListRcsSenders = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description: 'List RCS senders for the project. Returns up to 50 senders per page. Use pageToken for pagination.',
      inputSchema: ListRcsSendersSchema,
    },
    listRcsSendersHandler,
  );
};

export const listRcsSendersHandler = async ({ pageToken }: ListRcsSenders): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const response = await client.listSenders(pageToken);
    const senders = (response.senders ?? []).map(formatRcsSenderSummary);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        senders,
        nextPageToken: response.nextPageToken,
        pageCount: senders.length,
        totalCount: response.totalSize,
      }),
    ).promptResponse;
  });
