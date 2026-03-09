import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { formatListAllAppsResponse } from './utils/format-list-all-apps-response';
import { getConversationService, setConversationRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'listConversationApps';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAllApps = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Get a list of all Conversation apps in the account. Apps are created and configured in the Sinch Dashboard or with the Conversation API. The App is the entity that holds the credentials related to the various channels',
    listAllAppsHandler
  );
};

export const listAllAppsHandler = async (): Promise<IPromptResponse> => {

  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;

  const regions = [ 'us', 'eu', 'br' ];

  try {
    const allApps: any[] = [];
    const errors: { region: string; error: string }[] = [];

    for (const region of regions) {
      try {
        setConversationRegion(region, conversationService);
        const response = await conversationService.app.list({});
        const formatted = formatListAllAppsResponse(response);
        if (formatted.apps && formatted.apps.length > 0) {
          allApps.push(...formatted.apps.map((app: any) => ({
            ...app,
            region
          })));
        }
      } catch (error) {
        errors.push({
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new PromptResponse(JSON.stringify({
      success: errors.length === 0,
      apps: allApps,
      total_count: allApps.length,
      ...(errors.length > 0 && { errors })
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })).promptResponse;
  }
};
