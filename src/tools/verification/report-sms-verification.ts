import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVerificationService } from './utils/verification-service-helper';
import { getToolName, VerificationToolKey, verificationToolsConfig } from './utils/verification-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: VerificationToolKey = 'reportSmsVerification';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerReportSmsVerification = (server: McpServer, tags: Tags[]) => {
  if(!matchesAnyTag(tags, verificationToolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
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
  try {
    const maybeService = getVerificationService(TOOL_NAME);
    if (isPromptResponse(maybeService)) {
      return maybeService.promptResponse;
    }
    const verificationService = maybeService;

    const response = await verificationService.verifications.reportSmsByIdentity({
      endpoint: phoneNumber,
      reportSmsVerificationByIdentityRequestBody: {
        sms: {
          code: oneTimePassword
        }
      }
    });

    return new PromptResponse(JSON.stringify({
      success: true,
      verification_id: response.id,
      status: response.status
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
};
