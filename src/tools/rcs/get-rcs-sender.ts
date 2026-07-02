import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId } from './prompt-schemas';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const GetRcsSenderSchema = {
  senderId: RcsSenderId,
};

type GetRcsSender = z.infer<z.ZodObject<typeof GetRcsSenderSchema>>;

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
        "Get an RCS sender by ID. Returns authName and authToken needed for set-rcs-channel-on-app (as senderId and bearerToken respectively), plus state, details, and countryStatus. Note: the sender's `id` field must NOT be used as senderId in set-rcs-channel-on-app — use authName instead.",
      inputSchema: GetRcsSenderSchema,
    },
    getRcsSenderHandler,
  );
};

export const getRcsSenderHandler = async ({ senderId }: GetRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const sender = await client.getSender(senderId);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
