import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTtsCallout } from './tts-callout';
import { Tags } from '../../types';
import { registerGetCallInformation } from './get-call-information';
import { registerListCalls } from './list-calls';
import { registerGetSessionInformation } from './get-session-information';
import { registerCreateVoiceService } from './create-voice-service';
import { registerSetVoiceServiceWebhook } from './set-voice-service-webhook';
import { registerRemoveVoiceServiceWebhook } from './remove-voice-service-webhook';
import { registerTtsBatchCallout } from './tts-batch-callout';
import { registerGetBatchSummary } from './get-batch-summary';
import { registerAssignNumberToVoiceService } from './assign-number-to-voice-service';

export const registerVoiceTools = (server: McpServer, tags: Tags[]) => {
  registerTtsCallout(server, tags);
  registerGetCallInformation(server, tags);
  registerListCalls(server, tags);
  registerGetSessionInformation(server, tags);
  registerCreateVoiceService(server, tags);
  registerSetVoiceServiceWebhook(server, tags);
  registerRemoveVoiceServiceWebhook(server, tags);
  registerAssignNumberToVoiceService(server, tags);
  registerTtsBatchCallout(server, tags);
  registerGetBatchSummary(server, tags);
};
