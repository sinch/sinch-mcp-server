import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { DeleteWhatsAppTemplateByNameSchema } from './prompt-schemas';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

type DeleteWhatsAppTemplateByName = z.infer<z.ZodObject<typeof DeleteWhatsAppTemplateByNameSchema>>;

const TOOL_KEY: WhatsAppToolKey = 'deleteWhatsAppTemplateByName';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteWhatsAppTemplateByName = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Destructive — always ask the user to confirm the exact templateName in chat and wait for an explicit yes before calling this tool. Delete ALL language variants of a WhatsApp message template by name, in one call — draft and submitted variants alike, regardless of state. This is more destructive than delete-whatsapp-template, which only removes a single language variant; use this one only when every language of the template name should be removed. Once deleted, the name cannot be reused for new templates for 30 days. In-flight messages already sent with the deleted template keep attempting delivery for 30 days.',
      inputSchema: DeleteWhatsAppTemplateByNameSchema,
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    deleteWhatsAppTemplateByNameHandler,
  );
};

export const deleteWhatsAppTemplateByNameHandler = async ({
  templateName,
}: DeleteWhatsAppTemplateByName): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    await client.deleteTemplateByName(templateName);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        templateName,
      }),
    ).promptResponse;
  });
