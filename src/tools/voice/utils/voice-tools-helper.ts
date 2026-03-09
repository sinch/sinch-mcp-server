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
  }
}

export type VoiceToolKey = keyof typeof voiceToolsConfig;

export const getToolName = (toolKey: VoiceToolKey): string => voiceToolsConfig[toolKey].name;
