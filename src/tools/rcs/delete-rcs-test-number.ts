import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

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
      inputSchema: {
        senderId: RcsSenderId,
        testNumber: RcsTestNumber,
      },
    },
    deleteRcsTestNumberHandler,
  );
};

export const deleteRcsTestNumberHandler = async ({
  senderId,
  testNumber,
}: {
  senderId: string;
  testNumber: string;
}): Promise<IPromptResponse> =>
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
