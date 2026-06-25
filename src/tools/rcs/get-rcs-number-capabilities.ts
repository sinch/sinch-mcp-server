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
        'Returns the RCS features supported by a test number device. Possible features: ACTION_COMPOSE, ACTION_CREATE_CALENDAR_EVENT, ACTION_DIAL, ACTION_OPEN_URL, ACTION_OPEN_URL_IN_WEBVIEW, ACTION_SHARE_LOCATION, ACTION_VIEW_LOCATION, REVOCATION, RICHCARD_CAROUSEL, RICHCARD_STANDALONE.',
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
