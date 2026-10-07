import { ToolsConfig } from '../../../types';

export const voiceToolsConfig: Record<string, ToolsConfig> = {
  closeConference: {
    name: 'close-conference',
    tags: ['all', 'voice', 'close-conference'],
  },
  conferenceCallout: {
    name: 'conference-callout',
    tags: ['all', 'voice', 'conference-callout'],
  },
  manageConferenceParticipant: {
    name: 'manage-conference-participant',
    tags: ['all', 'voice', 'manage-conference-participant'],
  },
  ttsCallout: {
    name: 'tts-callout',
    tags: ['all', 'voice', 'notification', 'tts-callout'],
  },
  getCallInformation: {
    name: 'get-call-information',
    tags: ['all', 'voice', 'notification', 'get-call-information'],
  },
  listCalls: {
    name: 'list-calls',
    tags: ['all', 'voice', 'notification', 'list-calls'],
  },
  getSessionInformation: {
    name: 'get-session-information',
    tags: ['all', 'voice', 'notification', 'get-session-information'],
  },
  createVoiceService: {
    name: 'create-voice-service',
    tags: ['all', 'voice', 'configuration', 'create-voice-service'],
  },
  setVoiceServiceWebhook: {
    name: 'set-voice-service-webhook',
    tags: ['all', 'voice', 'configuration', 'set-voice-service-webhook'],
  },
  removeVoiceServiceWebhook: {
    name: 'remove-voice-service-webhook',
    tags: ['all', 'voice', 'configuration', 'remove-voice-service-webhook'],
  },
  assignNumberToVoiceService: {
    name: 'assign-number-to-voice-service',
    tags: ['all', 'voice', 'configuration', 'assign-number-to-voice-service'],
  },
  createTtsBatch: {
    name: 'create-tts-call-batch',
    tags: ['all', 'voice', 'notification', 'create-tts-call-batch'],
  },
  getBatchSummary: {
    name: 'get-voice-batch-summary',
    tags: ['all', 'voice', 'notification', 'get-voice-batch-summary'],
  },
};

export type VoiceToolKey = keyof typeof voiceToolsConfig;

export const getToolName = (toolKey: VoiceToolKey): string => voiceToolsConfig[toolKey].name;
