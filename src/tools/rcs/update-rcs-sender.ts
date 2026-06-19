import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsBillingCategory, RcsSenderDetails, RcsSenderId, RcsUseCase } from './prompt-schemas';
import { UpdateSenderRequest } from './types/rcs-api';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const UpdateRcsSenderSchema = {
  senderId: RcsSenderId,
  billingCategory: RcsBillingCategory.optional(),
  useCase: RcsUseCase.optional(),
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
        'Update an RCS sender. Accepts partial or full sender body — brand, questionnaire, countries, and other fields can be updated in one PATCH.',
      inputSchema: UpdateRcsSenderSchema,
    },
    updateRcsSenderHandler,
  );
};

export const updateRcsSenderHandler = async ({
  senderId,
  billingCategory,
  useCase,
  details,
}: UpdateRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const body: UpdateSenderRequest = {
      ...(billingCategory !== undefined && { billingCategory }),
      ...(useCase !== undefined && { useCase }),
      ...(details !== undefined && { details }),
    };

    if (Object.keys(body).length === 0) {
      return new PromptResponse(
        JSON.stringify({
          success: false,
          error: 'At least one of billingCategory, useCase, or details must be provided.',
        }),
      ).promptResponse;
    }

    const sender = await client.updateSender(senderId, body);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
