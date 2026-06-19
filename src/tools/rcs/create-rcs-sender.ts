import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsBillingCategory, RcsRegion, RcsSenderDetails, RcsUseCase } from './prompt-schemas';
import { CreateSenderRequest } from './types/rcs-api';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const CreateRcsSenderSchema = {
  region: RcsRegion,
  billingCategory: RcsBillingCategory,
  useCase: RcsUseCase,
  details: RcsSenderDetails,
};

type CreateRcsSender = z.infer<z.ZodObject<typeof CreateRcsSenderSchema>>;

const TOOL_KEY: RcsToolKey = 'createRcsSender';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateRcsSender = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Create an RCS sender. Required: region, billingCategory, useCase. Optionally include full details (brand, questionnaire, countries) in one call — steps 1–4 of the setup flow can be done here.',
      inputSchema: CreateRcsSenderSchema,
    },
    createRcsSenderHandler,
  );
};

export const createRcsSenderHandler = async ({
  region,
  billingCategory,
  useCase,
  details,
}: CreateRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    const body: CreateSenderRequest = {
      region,
      billingCategory,
      useCase,
      ...(details !== undefined && { details }),
    };
    const sender = await client.createSender(body);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        sender: formatRcsSender(sender),
      }),
    ).promptResponse;
  });
