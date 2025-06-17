import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNumberLookup } from './number-lookup';
import { registerReportSmsVerification } from './report-sms-verification';
import { registerStartVerificationWithSms } from './start-sms-verification';
import { Tags } from '../../types';

export const registerVerificationTools = (server: McpServer, tags: Tags[]) => {
  registerStartVerificationWithSms(server, tags);
  registerReportSmsVerification(server, tags);
  registerNumberLookup(server, tags);
};
