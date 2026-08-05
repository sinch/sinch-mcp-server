import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { DeleteAllWhatsAppTemplateVariantsSchema } from './prompt-schemas';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

type DeleteAllWhatsAppTemplateVariants = z.infer<z.ZodObject<typeof DeleteAllWhatsAppTemplateVariantsSchema>>;

const TOOL_KEY: WhatsAppToolKey = 'deleteAllWhatsAppTemplateVariants';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteAllWhatsAppTemplateVariants = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Destructive — always ask the user to confirm the exact templateName in chat and wait for an explicit yes before calling this tool. Delete ALL language variants of a WhatsApp message template by name, in one call — draft and submitted variants alike, regardless of state. This is more destructive than delete-single-whatsapp-template-variant, which only removes a single language variant; use this one only when every language of the template name should be removed. This does not free up the name — recreating a template with this same name and any language it had approved is blocked for 30 days. In-flight messages already sent with the deleted template keep attempting delivery for 30 days.',
      inputSchema: DeleteAllWhatsAppTemplateVariantsSchema,
    },
    deleteAllWhatsAppTemplateVariantsHandler,
  );
};

export const deleteAllWhatsAppTemplateVariantsHandler = async ({
  templateName,
}: DeleteAllWhatsAppTemplateVariants): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    await client.deleteTemplateByName(templateName);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        templateName,
      }),
    ).promptResponse;
  });
