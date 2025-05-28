import { Conversation } from '@sinch/sdk-core';

export const formatListAllTemplatesResponse = (
  data: Conversation.V2ListTemplatesResponse
): {
  id: string;
  description?: string;
  version: number;
  defaultTranslation: string;
  translations?: string[];
}[] => {
  return (data.templates ?? []).map((template) => ({
    id: template.id,
    description: template.description,
    version: template.version,
    defaultTranslation: template.default_translation,
    translations: template.translations?.map(
      (t) => `${t.language_code} (version "${t.version}")`
    ),
  }));
};

export const formatOmniChannelTemplates = (
  responseUS: Conversation.V2ListTemplatesResponse,
  responseEU: Conversation.V2ListTemplatesResponse,
  responseBR: Conversation.V2ListTemplatesResponse
): string => {
  return [
    `List of omni-channels templates in the US region: ${JSON.stringify(formatListAllTemplatesResponse(responseUS))}`,
    `List of omni-channels templates in the EU region: ${JSON.stringify(formatListAllTemplatesResponse(responseEU))}`,
    `List of omni-channels templates in the BR region: ${JSON.stringify(formatListAllTemplatesResponse(responseBR))}`,
  ].join('\n');
};

export const formatChannelSpecificTemplates = (
  templates: {
    channel: 'WhatsApp',
    name: string,
    language: string,
    category: string,
    state: string
  }[]
): string => {
  return `List of WhatsApp templates: ${JSON.stringify(templates)}`;
};

export const renderInstructions = `
Please return the data in a structured array format with each item on a separate line.

One array for omni-channel templates and another for channel-specific templates.

For the omni-channel templates, just display:
- Id
- Description
- Version
- Default translation
- List of translations as pairs of (language_code / version)

Example:
| ID   | Description       | Version | Default translation | Translations            |
| 0123 | My template desc  | 1       | en-US               | en-US(latest), en-US(1) |

For the WhatsApp templates (called channel-specific), just display:
- Channel
- Name
- Language
- Category
- State

Example:
| Channel  | Name         | Language | Category  | State    |
| WhatsApp | wa_template  | en-US    | Marketing | Approved |
`;
