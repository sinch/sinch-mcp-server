import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { getVerificationService } from './utils/verification-service-helper';
import { getToolName, VerificationToolKey, verificationToolsConfig } from './utils/verification-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const StartSmsVerificationSchema = {
  phoneNumber: z.string().describe('Phone number in E.164 format to send the SMS to'),
};

type StartSmsVerification = z.infer<z.ZodObject<typeof StartSmsVerificationSchema>>;

const TOOL_KEY: VerificationToolKey = 'startSmsVerification';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerStartVerificationWithSms = (server: McpServer, tags: Tags[]) => {
  if(!matchesAnyTag(tags, verificationToolsConfig[TOOL_KEY].tags)) return;

  registerTracedTool(server,
    TOOL_NAME,
    {
      description: 'Start new phone number verification requests. If the request is successful, you should ask the user to enter the OTP they received on the phone number we are verifying.',
      inputSchema: StartSmsVerificationSchema,
    },
    startSmsVerificationHandler
  );
};

export const startSmsVerificationHandler = async (
  { phoneNumber }: StartSmsVerification
): Promise<IPromptResponse> => {
  try {
    const maybeService = getVerificationService(TOOL_NAME);
    if (isPromptResponse(maybeService)) {
      return maybeService.promptResponse;
    }
    const verificationService = maybeService;

    const response = await verificationService.verifications.startSms({
      startVerificationWithSmsRequestBody: {
        identity: {
          type: 'number',
          endpoint: phoneNumber
        }
      }
    });

    return new PromptResponse(JSON.stringify({
      success: true,
      verification_id: response.id,
      phone_number: phoneNumber
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
};
