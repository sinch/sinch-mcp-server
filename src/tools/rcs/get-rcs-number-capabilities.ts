import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

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
        'Get RCS capabilities for a verified test number (e.g. RICHCARD_CAROUSEL, ACTION_DIAL). Use to choose message type before testing.',
      inputSchema: {
        senderId: RcsSenderId,
        testNumber: RcsTestNumber,
      },
    },
    getRcsNumberCapabilitiesHandler,
  );
};

export const getRcsNumberCapabilitiesHandler = async ({
  senderId,
  testNumber,
}: {
  senderId: string;
  testNumber: string;
}): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const capabilities = await client.getTestNumberCapabilities(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        features: capabilities.features ?? [],
        capabilities,
      }),
    ).promptResponse;
  });
