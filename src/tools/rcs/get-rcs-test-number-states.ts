import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const TOOL_KEY: RcsToolKey = 'getRcsTestNumberStates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetRcsTestNumberStates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Get the state of one RCS test number (PENDING, VERIFIED, UNVERIFIED, etc.). To see all test numbers at once, use get-rcs-sender.',
      inputSchema: {
        senderId: RcsSenderId,
        testNumber: RcsTestNumber,
      },
    },
    getRcsTestNumberStatesHandler,
  );
};

export const getRcsTestNumberStatesHandler = async ({
  senderId,
  testNumber,
}: {
  senderId: string;
  testNumber: string;
}): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const state = await client.getTestNumberState(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        testNumber: state,
      }),
    ).promptResponse;
  });
