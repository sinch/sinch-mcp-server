import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderDetails, RcsSenderId } from './prompt-schemas';
import { UpdateSenderRequest } from './types/rcs-api';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const UpdateRcsSenderSchema = {
  senderId: RcsSenderId,
  details: RcsSenderDetails,
};

type UpdateRcsSender = z.infer<z.ZodObject<typeof UpdateRcsSenderSchema>>;

const TOOL_KEY: RcsToolKey = 'updateRcsSender';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerUpdateRcsSender = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Update a RCS sender details (brand, countries, testNumbers, questionnaire). billingCategory, useCase, and region cannot be changed after creation.',
      inputSchema: UpdateRcsSenderSchema,
    },
    updateRcsSenderHandler,
  );
};

export const updateRcsSenderHandler = async ({ senderId, details }: UpdateRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    if (details === undefined || Object.keys(details).length === 0) {
      return new PromptResponse(
        JSON.stringify({
          success: false,
          error: 'A non-empty "details" object must be provided (e.g. brand, questionnaire, countries, testNumbers).',
        }),
      ).promptResponse;
    }

    const body: UpdateSenderRequest = { details };

    const sender = await client.updateSender(senderId, body);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
