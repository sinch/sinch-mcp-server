import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCloseConference } from './close-conference';
import { registerConferenceCallout } from './conference';
import { registerManageConferenceParticipant } from './manage-conference-participant';
import { registerTtsCallout } from './tts-callout';
import { Tags } from '../../types';
import { registerGetCallInformation } from './get-call-information';

export const registerVoiceTools = (server: McpServer, tags: Tags[]) => {
  registerTtsCallout(server, tags);
  registerGetCallInformation(server, tags);
  registerConferenceCallout(server, tags);
  registerManageConferenceParticipant(server, tags);
  registerCloseConference(server, tags);
};
