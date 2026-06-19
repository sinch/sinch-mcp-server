import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId } from './prompt-schemas';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const LaunchRcsSenderSchema = {
  senderId: RcsSenderId,
};

type LaunchRcsSender = z.infer<z.ZodObject<typeof LaunchRcsSenderSchema>>;

const TOOL_KEY: RcsToolKey = 'launchRcsSender';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerLaunchRcsSender = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Begin RCS sender launch (Google + carrier review). Requires completed questionnaire, countries, brand assets, and contact info. Returns 412 if checklist is incomplete.',
      inputSchema: LaunchRcsSenderSchema,
    },
    launchRcsSenderHandler,
  );
};

export const launchRcsSenderHandler = async ({ senderId }: LaunchRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const sender = await client.launchSender(senderId);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
