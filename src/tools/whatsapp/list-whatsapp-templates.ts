import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runWhatsAppHandler } from './utils/whatsapp-handler-helper';
import { getToolName, toolsConfig, WhatsAppToolKey } from './utils/whatsapp-tools-helper';

const TOOL_KEY: WhatsAppToolKey = 'listWhatsAppTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListWhatsAppTemplates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get a list of the WhatsApp channel-specific message templates (submitted to and reviewed by Meta) belonging to a project. Note that the omni-channel messaging templates (managed by Sinch) are NOT included in this list - use the list-messaging-templates tool to fetch them. If the user asks for all their messaging templates, you can combine this tool with list-messaging-templates.',
    },
    listWhatsAppTemplatesHandler,
  );
};

export const listWhatsAppTemplatesHandler = async (): Promise<IPromptResponse> =>
  runWhatsAppHandler(TOOL_NAME, async (client) => {
    const { templates } = await client.listTemplates();

    const whatsAppTemplates = templates.map((template) => ({
      name: template.name,
      language: template.language,
      category: template.category,
      state: template.state,
    }));

    return new PromptResponse(
      JSON.stringify({
        success: true,
        templates: whatsAppTemplates,
        total_count: whatsAppTemplates.length,
        related_tools: {
          'list-messaging-templates':
            'Omni-channel messaging templates (managed by Sinch) are not included in this list. Use the list-messaging-templates tool to fetch them if the user wants them.',
        },
      }),
    ).promptResponse;
  });
