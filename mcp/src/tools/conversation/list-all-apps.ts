import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { hasMatchingTag, isPromptResponse } from '../../utils';
import { formatListAllAppsResponse } from './utils/format-list-all-apps-response';
import { getConversationService } from './utils/conversation-service-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

export const registerListAllApps = (server: McpServer, tags: Tags[]) => {
  if (!hasMatchingTag(['all', 'conversation', 'notification'], tags)) {
    return;
  }

  server.tool(
    'list-all-apps',
    'Get a list of all Conversation apps in the account. Apps are created and configured in the Sinch Dashboard or with the Conversation API. The App is the entity that holds the credentials related to the various channels',
    listAllAppsHandler
  );
};

export const listAllAppsHandler = async (): Promise<IPromptResponse> => {

  const maybeClient = getConversationService();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const sinchClient = maybeClient;

  const regions = [ 'us', 'eu', 'br' ];

  let reply = '';
  try {
    for (const region of regions) {
      sinchClient.conversation.setRegion(region);
      const response = await sinchClient.conversation.app.list({});
      reply += `${reply ? '\n' : ''}List of conversations apps in the '${region}' region: ${JSON.stringify(formatListAllAppsResponse(response))}`;
    }
  } catch (error) {
    return new PromptResponse(`Error fetching apps: ${error instanceof Error ? error.message : 'Unknown error'}`).promptResponse;
  }

  return new PromptResponse(`${reply}.\nPlease return the data in a structured array format with each item on a separate line. Just display the Id, display name, channels and region columns. Example:
| ID   | Display name | Channels       | Region |
| 0123 | My app name  | SMS, MESSENGER | US     |`).promptResponse;
};
