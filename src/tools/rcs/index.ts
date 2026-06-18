import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { registerAddRcsTestNumber } from './add-rcs-test-number';
import { registerCreateRcsSender } from './create-rcs-sender';
import { registerDeleteRcsTestNumber } from './delete-rcs-test-number';
import { registerGetRcsNumberCapabilities } from './get-rcs-number-capabilities';
import { registerGetRcsSender } from './get-rcs-sender';
import { registerGetRcsTestNumberStates } from './get-rcs-test-number-states';
import { registerLaunchRcsSender } from './launch-rcs-sender';
import { registerListRcsSenders } from './list-rcs-senders';
import { registerRcsResources } from './resources/register-rcs-resources';
import { registerResendRcsTestNumberInvite } from './resend-rcs-test-number-invite';
import { registerUpdateRcsSender } from './update-rcs-sender';

export const registerRcsTools = (server: McpServer, tags: Tags[]) => {
  registerListRcsSenders(server, tags);
  registerGetRcsSender(server, tags);
  registerCreateRcsSender(server, tags);
  registerUpdateRcsSender(server, tags);
  registerAddRcsTestNumber(server, tags);
  registerDeleteRcsTestNumber(server, tags);
  registerResendRcsTestNumberInvite(server, tags);
  registerGetRcsNumberCapabilities(server, tags);
  registerGetRcsTestNumberStates(server, tags);
  registerLaunchRcsSender(server, tags);
  registerRcsResources(server, tags);
};
