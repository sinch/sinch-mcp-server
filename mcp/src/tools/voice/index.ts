import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCloseConference } from './close-conference';
import { registerConferenceCallout } from './conference';
import { registerManageConferenceParticipant } from './manage-conference-participant';
import { registerTtsCallout } from './tts-callout';
import { Tags } from '../../types';

export const registerVoiceTools = (server: McpServer, tags: Tags[]) => {
  registerTtsCallout(server, tags);
  registerConferenceCallout(server, tags);
  registerManageConferenceParticipant(server, tags);
  registerCloseConference(server, tags);
};
