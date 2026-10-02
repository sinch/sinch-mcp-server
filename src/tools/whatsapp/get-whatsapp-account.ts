import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

const TOOL_KEY: WhatsAppToolKey = 'getWhatsAppAccount';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetWhatsAppAccount = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get the WhatsApp Business Account (WABA) for the project: state, WABA ID, business details, ban state and date, daily message limit, compatible regions, and the Insights / Direct Send flags. Note: the Meta quality rating is not part of the response.',
    },
    getWhatsAppAccountHandler,
  );
};

export const getWhatsAppAccountHandler = async (): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    const account = await client.getAccount();

    return new PromptResponse(
      JSON.stringify({
        success: true,
        account,
      }),
    ).promptResponse;
  });
