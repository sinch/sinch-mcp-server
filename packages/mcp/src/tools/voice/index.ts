import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCloseConference } from './close-conference.js';
import { registerConferenceCallout } from './conference.js';
import { registerManageConferenceParticipant } from './manage-conference-participant.js';
import { registerTtsCallout } from './tts-callout.js';

export const registerVoiceTools = (server: McpServer) => {
  registerTtsCallout(server);
  registerConferenceCallout(server);
  registerCloseConference(server);
  registerManageConferenceParticipant(server);
};
