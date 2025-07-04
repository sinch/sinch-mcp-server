import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationClient } from './utils/verification-service-helper';
import { getToolName, shouldRegisterTool, VerificationToolKey } from './utils/verification-tools-helper';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: VerificationToolKey = 'startSmsVerification';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerStartVerificationWithSms = (server: McpServer, tags: Tags[]) => {
  if(!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Start new phone number verification requests. If the request is successful, you should ask the user to enter the OTP they received on the phone number we are verifying.',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format to send the SMS to')
    },
    startSmsVerificationHandler
  );
};

export const startSmsVerificationHandler = async (
  { phoneNumber }: { phoneNumber: string }
): Promise<IPromptResponse> => {
  const maybeClient = getVerificationClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const verificationService = maybeClient.verification;

  const response = await verificationService.verifications.startSms({
    startVerificationWithSmsRequestBody: {
      identity: {
        type: 'number',
        endpoint: phoneNumber
      }
    }
  });

  return new PromptResponse(`Started verification for ${phoneNumber}. The verification ID is ${response.id}`).promptResponse;
};
