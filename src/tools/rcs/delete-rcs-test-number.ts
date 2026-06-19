import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const DeleteRcsTestNumberSchema = {
  senderId: RcsSenderId,
  testNumber: RcsTestNumber,
};

type DeleteRcsTestNumber = z.infer<z.ZodObject<typeof DeleteRcsTestNumberSchema>>;

const TOOL_KEY: RcsToolKey = 'deleteRcsTestNumber';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteRcsTestNumber = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Delete a test number from an RCS sender. Use when state is DECLINED, REJECTED, or INVALID before re-adding.',
      inputSchema: DeleteRcsTestNumberSchema,
    },
    deleteRcsTestNumberHandler,
  );
};

export const deleteRcsTestNumberHandler = async ({
  senderId,
  testNumber,
}: DeleteRcsTestNumber): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    await client.deleteTestNumber(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        senderId,
        testNumber,
      }),
    ).promptResponse;
  });
