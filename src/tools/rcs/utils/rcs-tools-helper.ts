import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => config;

export const toolsConfig = defineToolsConfig({
  listRcsSenders: {
    name: 'list-rcs-senders',
    tags: ['all', 'rcs', 'configuration', 'list-rcs-senders'],
  },
  getRcsSender: {
    name: 'get-rcs-sender',
    tags: ['all', 'rcs', 'configuration', 'get-rcs-sender'],
  },
  createRcsSender: {
    name: 'create-rcs-sender',
    tags: ['all', 'rcs', 'configuration', 'create-rcs-sender'],
  },
  updateRcsSender: {
    name: 'update-rcs-sender',
    tags: ['all', 'rcs', 'configuration', 'update-rcs-sender'],
  },
  addRcsTestNumber: {
    name: 'add-rcs-test-number',
    tags: ['all', 'rcs', 'configuration', 'add-rcs-test-number'],
  },
  deleteRcsTestNumber: {
    name: 'delete-rcs-test-number',
    tags: ['all', 'rcs', 'configuration', 'delete-rcs-test-number'],
  },
  resendRcsTestNumberInvite: {
    name: 'resend-rcs-test-number-invite',
    tags: ['all', 'rcs', 'configuration', 'resend-rcs-test-number-invite'],
  },
  getRcsNumberCapabilities: {
    name: 'get-rcs-number-capabilities',
    tags: ['all', 'rcs', 'configuration', 'get-rcs-number-capabilities'],
  },
  getRcsTestNumberState: {
    name: 'get-rcs-test-number-state',
    tags: ['all', 'rcs', 'configuration', 'get-rcs-test-number-state'],
  },
  launchRcsSender: {
    name: 'launch-rcs-sender',
    tags: ['all', 'rcs', 'configuration', 'launch-rcs-sender'],
  },
});

export type RcsToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: RcsToolKey): string => toolsConfig[toolKey].name;
