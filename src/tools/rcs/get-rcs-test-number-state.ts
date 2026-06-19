import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const GetRcsTestNumberStateSchema = {
  senderId: RcsSenderId,
  testNumber: RcsTestNumber,
};

type GetRcsTestNumberState = z.infer<z.ZodObject<typeof GetRcsTestNumberStateSchema>>;

const TOOL_KEY: RcsToolKey = 'getRcsTestNumberState';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetRcsTestNumberState = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Get the state of one RCS test number (PENDING, VERIFIED, UNVERIFIED, etc.). To see all test numbers at once, use get-rcs-sender.',
      inputSchema: GetRcsTestNumberStateSchema,
    },
    getRcsTestNumberStateHandler,
  );
};

export const getRcsTestNumberStateHandler = async ({
  senderId,
  testNumber,
}: GetRcsTestNumberState): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const state = await client.getTestNumberState(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        testNumber: state,
      }),
    ).promptResponse;
  });
