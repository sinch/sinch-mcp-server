import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { UpdateWhatsAppTemplateSchema } from './prompt-schemas';
import { UpdateWhatsAppTemplateRequest } from './types/whatsapp-api';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

type UpdateWhatsAppTemplate = z.infer<z.ZodObject<typeof UpdateWhatsAppTemplateSchema>>;

const TOOL_KEY: WhatsAppToolKey = 'updateWhatsAppTemplate';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerUpdateWhatsAppTemplate = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Update a DRAFT WhatsApp message template, identified by templateName and languageCode. Approved, Rejected, Paused, or Disabled templates can also be updated, and are reset to draft. Not every field can be changed this way — unsupported changes require deleting the draft and creating a new one.',
      inputSchema: UpdateWhatsAppTemplateSchema,
    },
    updateWhatsAppTemplateHandler,
  );
};

export const updateWhatsAppTemplateHandler = async ({
  templateName,
  languageCode,
  status,
  category,
  allowCategoryChange,
  details,
}: UpdateWhatsAppTemplate): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    const body: UpdateWhatsAppTemplateRequest = {
      ...(status !== undefined && { status }),
      ...(category !== undefined && { category }),
      ...(allowCategoryChange !== undefined && { allowCategoryChange }),
      ...(details !== undefined && { details }),
    };

    if (Object.keys(body).length === 0) {
      return new PromptResponse(
        JSON.stringify({
          success: false,
          error:
            'No fields provided to update. Specify at least one of: status, category, allowCategoryChange, details.',
        }),
      ).promptResponse;
    }

    const template = await client.updateTemplate(templateName, languageCode, body);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        template,
      }),
    ).promptResponse;
  });
