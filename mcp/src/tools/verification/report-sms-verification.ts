import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationService } from './utils/verification-service-helper';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

export const registerReportSmsVerification = (server: McpServer, tags: Tags[]) => {
  if (!tags.includes('all') && !tags.includes('verification')) {
    return;
  }

  server.tool(
    'report-sms-verification',
    'Report the received verification code to verify it, using the phone number of the user',
    {
      phoneNumber: z.string().describe('Phone number in E.164 format used to start the verification process'),
      oneTimePassword: z.string().describe('The code which was received by the user submitting the SMS verification.')
    },
    reportSmsVerificationHandler
  );
};

export const reportSmsVerificationHandler = async (
  { phoneNumber, oneTimePassword }: { phoneNumber: string; oneTimePassword: string; }
): Promise<IPromptResponse> => {
  const maybeClient = getVerificationService();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const verificationService = maybeClient.verification;

  const response = await verificationService.verifications.reportSmsByIdentity({
    endpoint: phoneNumber,
    reportSmsVerificationByIdentityRequestBody: {
      sms: {
        code: oneTimePassword
      }
    }
  });

  return response.status === 'SUCCESSFUL' ?
    new PromptResponse(`Verification successful for number ${phoneNumber}. The verification ID is ${response.id}`).promptResponse
    : new PromptResponse(`Failed to verify the phone number ${phoneNumber}. The verification ID is ${response.id}`).promptResponse;
};
