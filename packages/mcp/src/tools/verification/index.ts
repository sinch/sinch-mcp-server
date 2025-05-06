import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNumberLookup } from './number-lookup.js';
import { registerReportSmsVerification } from './report-sms-verification.js';
import { registerStartVerificationWithSms } from './start-sms-verification.js';

export const registerVerificationTools = (server: McpServer) => {
  registerStartVerificationWithSms(server);
  registerReportSmsVerification(server);
  registerNumberLookup(server);
};
