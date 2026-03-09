import { ToolsConfig } from '../../../types';

export const verificationToolsConfig: Record<string, ToolsConfig> = {
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
