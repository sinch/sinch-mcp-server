import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getToolName, VerificationToolKey, verificationToolsConfig } from './utils/verification-tools-helper';
import { getNumberLookupService } from './utils/number-lookup-service-helper';

const NumberLookupSchema = {
  phoneNumber: z.string().describe('Phone number in E.164 format to look up'),
};

type NumberLookup = z.infer<z.ZodObject<typeof NumberLookupSchema>>;

const TOOL_KEY: VerificationToolKey = 'numberLookup';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerNumberLookup = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, verificationToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description: 'Look up a phone number for its status and capabilities.',
      inputSchema: NumberLookupSchema,
    },
    numberLookupHandler,
  );
};

export const numberLookupHandler = async ({ phoneNumber }: NumberLookup): Promise<IPromptResponse> => {
  const maybeService = getNumberLookupService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numberLookupService = maybeService;

  try {
    const response = await numberLookupService.lookup({
      numberLookupRequestBody: {
        number: phoneNumber,
        features: ['LineType'],
      },
    });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: response,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: `Failed to look up number '${phoneNumber}': ${error instanceof Error ? error.message : String(error)}`,
      }),
    ).promptResponse;
  }
};
