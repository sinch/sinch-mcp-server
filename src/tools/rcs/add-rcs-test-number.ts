import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const AddRcsTestNumberSchema = {
  senderId: RcsSenderId,
  testNumbers: z
    .array(RcsTestNumber)
    .min(1)
    .max(200)
    .refine((items) => new Set(items).size === items.length, { message: 'Phone numbers must be unique.' })
    .describe(
      'Phone numbers for testing. An agent can send 20 tester requests each day with a total maximum of 200 tester requests.',
    ),
};

type AddRcsTestNumber = z.infer<z.ZodObject<typeof AddRcsTestNumberSchema>>;

const TOOL_KEY: RcsToolKey = 'addRcsTestNumber';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAddRcsTestNumber = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Add test phone numbers to an RCS sender. Re-adding a verified number resets it to unverified.',
      inputSchema: AddRcsTestNumberSchema,
    },
    addRcsTestNumberHandler,
  );
};

export const addRcsTestNumberHandler = async ({ senderId, testNumbers }: AddRcsTestNumber): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const response = await client.addTestNumbers(senderId, testNumbers);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        testNumbers: response.testNumbers ?? [],
      }),
    ).promptResponse;
  });
