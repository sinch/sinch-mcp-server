import { ToolsConfig } from '../../../types';
import { matchesAnyTag } from '../../../utils';
import { ENABLED, toolsStatusMap } from '../../../tools-config';

const toolsConfig: Record<string, ToolsConfig> = {
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

export type VoiceToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: VoiceToolKey): string => toolsConfig[toolKey].name;

export const shouldRegisterTool = (toolKey: VoiceToolKey, tags: string[]): boolean => {
  const filteringTags = toolsConfig[toolKey].tags;
  const toolName = toolsConfig[toolKey].name;
  if (!matchesAnyTag(filteringTags, tags)) {
    toolsStatusMap[toolName] = `The filtering tags don't contain ${filteringTags.join(' or ')}`;
    return false;
  }
  const missingCredentials = getMissingEnvironmentVariables();
  if (missingCredentials.length > 0) {
    toolsStatusMap[toolName] = `Incorrect configuration. The environment variables are not set: ${missingCredentials.join(', ')}`;
    return false;
  }
  toolsStatusMap[toolName] = ENABLED;
  return true;
}

export const getMissingEnvironmentVariables = (): string[] => {
  const requiredEnvVars = [
    'VOICE_APPLICATION_KEY',
    'VOICE_APPLICATION_SECRET',
  ];
  return requiredEnvVars.filter((envVar) => !process.env[envVar]);
}
