import { Conversation } from '@sinch/sdk-core';
import {
  formatListAllTemplatesResponse
} from '../../../../src/tools/conversation/utils/format-list-all-templates-response';

describe('formatListAllTemplatesResponse', () => {
  it('should correctly format templates with all fields present', () => {
    const input: Conversation.V2ListTemplatesResponse = {
      templates: [
        {
          id: 'template1',
          description: 'Welcome message',
          version: 1,
          default_translation: 'en-US',
          translations: [
            {
              language_code: 'en-US',
              version: '1',
              create_time: new Date('2024-07-17T14:37:36Z'),
              update_time: new Date('2024-07-17T14:37:36Z'),
              variables: [{ key: 'name', preview_value: 'Professor Jones' }],
              text_message: { text: 'Hello ${name}' },
              channel_template_overrides: {}
            },
            { language_code: 'fr-FR', version: '2', text_message: { text: 'Bonjour ${name}' }},
          ],
        },
      ],
    };

    const result = formatListAllTemplatesResponse(input);
    expect(result).toEqual([
      {
        id: 'template1',
        description: 'Welcome message',
        version: 1,
        defaultTranslation: 'en-US',
        translations: ['en-US (version "1")', 'fr-FR (version "2")'],
      },
    ]);
  });

  it('should return an empty array when templates is an empty array', () => {
    const input: Conversation.V2ListTemplatesResponse = { templates: [] };
    const result = formatListAllTemplatesResponse(input);
    expect(result).toEqual([]);
  });
});
