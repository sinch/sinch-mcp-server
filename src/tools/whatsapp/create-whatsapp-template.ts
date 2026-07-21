import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { CreateWhatsAppTemplateSchema } from './prompt-schemas';
import { CreateWhatsAppTemplateRequest } from './types/whatsapp-api';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

type CreateWhatsAppTemplate = z.infer<z.ZodObject<typeof CreateWhatsAppTemplateSchema>>;

const TOOL_KEY: WhatsAppToolKey = 'createWhatsAppTemplate';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateWhatsAppTemplate = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Create a WhatsApp message template in the project. Required fields: name, language, category. Provide details.components to define the content — it must include a BODY component. If status is SUBMIT (the default), the template is submitted for review immediately; if DRAFT, it is saved without validation for later editing.',
      inputSchema: CreateWhatsAppTemplateSchema,
    },
    createWhatsAppTemplateHandler,
  );
};

export const createWhatsAppTemplateHandler = async ({
  name,
  language,
  category,
  details,
  status,
  saveDraftOnFailure,
  allowCategoryChange,
}: CreateWhatsAppTemplate): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    const body: CreateWhatsAppTemplateRequest = {
      name,
      language,
      category,
      ...(details !== undefined && { details }),
      ...(status !== undefined && { status }),
      ...(saveDraftOnFailure !== undefined && { saveDraftOnFailure }),
      ...(allowCategoryChange !== undefined && { allowCategoryChange }),
    };
    const template = await client.createTemplate(body);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        template,
      }),
    ).promptResponse;
  });
