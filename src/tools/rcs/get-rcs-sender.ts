import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId } from './prompt-schemas';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const TOOL_KEY: RcsToolKey = 'getRcsSender';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetRcsSender = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Get an RCS sender by ID. Returns authName and authToken needed for set-rcs-channel-on-app, plus state, details, and countryStatus.',
      inputSchema: {
        senderId: RcsSenderId,
      },
    },
    getRcsSenderHandler,
  );
};

export const getRcsSenderHandler = async ({ senderId }: { senderId: string }): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const sender = await client.getSender(senderId);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
