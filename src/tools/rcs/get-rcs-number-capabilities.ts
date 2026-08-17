import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const GetRcsNumberCapabilitiesSchema = {
  senderId: RcsSenderId,
  testNumber: RcsTestNumber,
};

type GetRcsNumberCapabilities = z.infer<z.ZodObject<typeof GetRcsNumberCapabilitiesSchema>>;

const TOOL_KEY: RcsToolKey = 'getRcsNumberCapabilities';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetRcsNumberCapabilities = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Return RCS features supported by a specific RCS test number device registered on a given RCS agent (supported actions, rich card layouts, revocation). Requires senderId and the test phone number. Use when the user asks whether a tester can receive RCS / which RCS features their device supports. Do NOT use number-lookup for this — that checks carrier/line type, not RCS client capabilities.',
      inputSchema: GetRcsNumberCapabilitiesSchema,
    },
    getRcsNumberCapabilitiesHandler,
  );
};

export const getRcsNumberCapabilitiesHandler = async ({
  senderId,
  testNumber,
}: GetRcsNumberCapabilities): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const capabilities = await client.getTestNumberCapabilities(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        capabilities,
      }),
    ).promptResponse;
  });
