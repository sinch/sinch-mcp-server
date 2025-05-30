import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse } from '../../utils';
import { formatListAllAppsResponse } from './utils/format-list-all-apps-response';
import { getConversationService } from './utils/conversation-service-helper';
import { IPromptResponse, PromptResponse } from '../../types';

export const registerListAllApps = (server: McpServer) => {
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

  const responseUS = await sinchClient.conversation.app.list({});

  sinchClient.conversation.setRegion('eu');
  const responseEU = await sinchClient.conversation.app.list({});

  sinchClient.conversation.setRegion('br');
  const responseBR = await sinchClient.conversation.app.list({});

  let reply = `List of conversations apps in the US region: ${JSON.stringify(formatListAllAppsResponse(responseUS))}`;
  reply += `\nList of conversations apps in the EU region: ${JSON.stringify(formatListAllAppsResponse(responseEU))}`;
  reply += `\nList of conversations apps in the BR region: ${JSON.stringify(formatListAllAppsResponse(responseBR))}`;

  return new PromptResponse(`${reply}.\nPlease return the data in a structured array format with each item on a separate line. Just display the Id, display name, channels and region columns. Example:
| ID   | Display name | Channels       | Region |
| 0123 | My app name  | SMS, MESSENGER | US     |`).promptResponse;
};
