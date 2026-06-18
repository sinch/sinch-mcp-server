import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId, RcsTestNumber } from './prompt-schemas';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const TOOL_KEY: RcsToolKey = 'resendRcsTestNumberInvite';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerResendRcsTestNumberInvite = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Resend a test number invite for an RCS sender. Use when state is PENDING or UNVERIFIED. Resets VERIFIED to UNVERIFIED.',
      inputSchema: {
        senderId: RcsSenderId,
        testNumber: RcsTestNumber,
      },
    },
    resendRcsTestNumberInviteHandler,
  );
};

export const resendRcsTestNumberInviteHandler = async ({
  senderId,
  testNumber,
}: {
  senderId: string;
  testNumber: string;
}): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const state = await client.resendTestNumberInvite(senderId, testNumber);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        testNumber: state,
      }),
    ).promptResponse;
  });
