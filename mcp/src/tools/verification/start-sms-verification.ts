import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationService } from './utils/verification-service-helper';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse } from '../../types';

export const registerStartVerificationWithSms = (server: McpServer) => {
  server.tool(
    'start-sms-verification',
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
  const maybeClient = getVerificationService();
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
