import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNumberLookup } from './number-lookup';
import { registerReportSmsVerification } from './report-sms-verification';
import { registerStartVerificationWithSms } from './start-sms-verification';

export const registerVerificationTools = (server: McpServer) => {
  registerStartVerificationWithSms(server);
  registerReportSmsVerification(server);
  registerNumberLookup(server);
};
