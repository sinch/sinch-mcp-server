import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { DeleteWhatsAppTemplateSchema } from './prompt-schemas';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

type DeleteWhatsAppTemplate = z.infer<z.ZodObject<typeof DeleteWhatsAppTemplateSchema>>;

const TOOL_KEY: WhatsAppToolKey = 'deleteWhatsAppTemplate';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteWhatsAppTemplate = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Destructive — always ask the user to confirm the exact templateName and languageCode in chat and wait for an explicit yes before calling this tool. Delete ONE language variant of a WhatsApp message template, identified by templateName and languageCode — other language variants of this template name are left untouched. To delete every language variant of a template name at once, use delete-all-whatsapp-template-variants instead. By default only the draft is removed; set deleteSubmitted to also remove a template already submitted to Meta. The template name itself is not freed up by deletion — recreating a template with this same name and language is blocked for 30 days after an approved variant is deleted; update the submitted template instead if you need it again soon.',
      inputSchema: DeleteWhatsAppTemplateSchema,
    },
    deleteWhatsAppTemplateHandler,
  );
};

export const deleteWhatsAppTemplateHandler = async ({
  templateName,
  languageCode,
  deleteSubmitted,
}: DeleteWhatsAppTemplate): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    await client.deleteTemplate(templateName, languageCode, deleteSubmitted);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        templateName,
        languageCode,
      }),
    ).promptResponse;
  });
