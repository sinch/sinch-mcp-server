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
