import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCloseConference } from './close-conference';
import { registerConferenceCallout } from './conference';
import { registerManageConferenceParticipant } from './manage-conference-participant';
import { registerTtsCallout } from './tts-callout';

export const registerVoiceTools = (server: McpServer) => {
  registerTtsCallout(server);
  registerConferenceCallout(server);
  registerCloseConference(server);
  registerManageConferenceParticipant(server);
};
