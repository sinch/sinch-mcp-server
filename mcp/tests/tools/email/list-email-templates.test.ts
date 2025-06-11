import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';
import { listEmailTemplatesHandler } from '../../../src/tools/email/list-email-templates';

// Mock fetch
global.fetch = jest.fn();

describe('listEmailTemplatesHandler', () => {
  const mockCredentials = {
    domain: 'example.com',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(mockCredentials);
  });

  it('returns formatted prompt response with templates', async () => {
    // Given
    const mockResponse = {
      items: [
        {
          id: 'template1',
          name: 'my Template 1',
          description: 'The template #1',
          createdAt: 'Fri, 28 Mar 2025 17:42:30 UTC'
        },
        {
          id: 'template2',
          name: 'my Template 2',
          description: 'The template #2',
          createdAt: 'Wed, 26 Mar 2025 11:11:48 UTC'
        }
      ]
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // When
    const result = await listEmailTemplatesHandler({});

    // Then
    const expectedText = [
      'The following templates must be presented as an array ALL their data in 3 columns: Name, Description and Creation Date. Do not omit anything.',
      '',
      'Found 2 Email templates for domain "example.com":',
      '',
      '| Name | Description | Creation Date |',
      '|------|-------------|---------------|',
      '| my Template 1 | The template #1 | 2025-03-28T17:42:30.000Z |',
      '| my Template 2 | The template #2 | 2025-03-26T11:11:48.000Z |\n'
    ].join('\n');

    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedText);
  });

  it('handles Mailgun API error', async () => {
    // Given
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    // When
    const result = await listEmailTemplatesHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Mailgun API error: 403 Forbidden').promptResponse);
  });

  it('handles JSON parse error', async () => {
    // Given
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json'); }
    });

    // When
    const result = await listEmailTemplatesHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Failed to parse JSON response: Error: invalid json').promptResponse);
  });

  it('returns early on credential fetch error', async () => {
    // Given
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(new PromptResponse('Missing credentials'));

    // When
    const result = await listEmailTemplatesHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Missing credentials').promptResponse);
  });
});
