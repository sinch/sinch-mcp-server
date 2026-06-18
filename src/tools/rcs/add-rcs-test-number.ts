import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const TOOL_KEY: RcsToolKey = 'addRcsTestNumber';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAddRcsTestNumber = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Add test phone numbers to an RCS sender. Limit: 20 invites/day, 200 total. Re-adding a verified number resets it to unverified.',
      inputSchema: {
        senderId: RcsSenderId,
        testNumbers: z.array(RcsTestNumber).min(1).describe('E.164 phone numbers to invite as testers.'),
      },
    },
    addRcsTestNumberHandler,
  );
};

export const addRcsTestNumberHandler = async ({
  senderId,
  testNumbers,
}: {
  senderId: string;
  testNumbers: string[];
}): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const response = await client.addTestNumbers(senderId, testNumbers);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        testNumbers: response.testNumbers ?? [],
      }),
    ).promptResponse;
  });
