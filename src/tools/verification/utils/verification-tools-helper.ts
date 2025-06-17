import { ToolsConfig } from '../../../types';
import { matchesAnyTag } from '../../../utils';
import { ENABLED, toolsStatusMap } from '../../../tools-config';

const verificationToolsConfig: Record<string, ToolsConfig> = {
  numberLookup: {
    name: 'number-lookup',
    tags: ['all', 'verification', 'number-lookup'],
  },
  reportSmsVerification: {
    name: 'report-sms-verification',
    tags: ['all', 'verification', 'report-sms-verification'],
  },
  startSmsVerification: {
    name: 'start-sms-verification',
    tags: ['all', 'verification', 'start-sms-verification'],
  }
}

export type VerificationToolKey = keyof typeof verificationToolsConfig;

export const getToolName = (toolKey: VerificationToolKey): string => verificationToolsConfig[toolKey].name;

export const shouldRegisterTool = (toolKey: VerificationToolKey, tags: string[]): boolean => {
  const filteringTags = verificationToolsConfig[toolKey].tags;
  const toolName = verificationToolsConfig[toolKey].name;
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
    'VERIFICATION_APPLICATION_KEY',
    'VERIFICATION_APPLICATION_SECRET',
  ];
  return requiredEnvVars.filter((envVar) => !process.env[envVar]);
}
