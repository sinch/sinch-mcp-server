import { listEmailEventsHandler } from '../../../src/tools/email/list-email-events';
import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';

// Mock fetch
global.fetch = jest.fn();

describe('listEmailEventsHandler', () => {
  const mockCredentials = {
    domain: 'example.com',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockResolvedValue(mockCredentials);
  });

  it('returns formatted prompt response with grouped events', async () => {
    // Given
    const mockResponse = {
      items: [
        {
          id: 'event1',
          timestamp: 1710000000.7552662,
          event: 'accepted',
          recipient: 'user@example.com',
          message: {
            headers: {
              'message-id': 'abc123@example.com',
              from: 'sender@example.com',
              to: 'user@example.com',
              subject: 'Test Subject'
            }
          }
        },
        {
          id: 'event2',
          timestamp: 1710000100.1638649,
          event: 'delivered',
          recipient: 'user@example.com',
          message: {
            headers: {
              'message-id': 'abc123@example.com',
              from: 'sender@example.com',
              to: 'user@example.com',
              subject: 'Test Subject'
            }
          }
        },
        {
          id: 'event3',
          timestamp: 1710000200.745685,
          event: 'opened',
          recipient: 'user@example.com',
          message: {
            headers: {
              'message-id': 'abc123@example.com',
            }
          }
        },
        {
          id: 'event3',
          timestamp: 1710000300.8591378,
          event: 'opened',
          recipient: 'other@example.com',
          message: {
            headers: {
              'message-id': 'xyz789@example.com',
            }
          }
        }
      ]
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // When
    const result = await listEmailEventsHandler({});

    // Then
    const expectedText = [
      'The following events must be presented with ALL their data, even if the ID is long, it MUST be displayed as this information can be used to get subsequent information on other API endpoints.',
      'Found 4 email events for domain example.com:',
      '**Message ID:** abc123@example.com',
      'From: sender@example.com',
      'To: user@example.com',
      'Subject: Test Subject',
      '| Event | Timestamp (UTC) |',
      '|-------|-----------------|',
      '| accepted | 2024-03-09T16:00:00.755Z |',
      '| delivered | 2024-03-09T16:01:40.163Z |',
      '| opened | 2024-03-09T16:03:20.745Z |',
      '',
      '**Message ID:** xyz789@example.com',
      '| Event | Timestamp (UTC) |',
      '|-------|-----------------|',
      '| opened | 2024-03-09T16:05:00.859Z |\n'
    ].join('\n');

    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedText);
  });

  it('returns formatted prompt response with grouped events filtered by input parameters', async () => {
    // Given
    const mockResponse = {
      items: [
        {
          id: 'event3',
          timestamp: 1710000200.745685,
          event: 'opened',
          recipient: 'user@example.com',
          message: {
            headers: {
              'message-id': 'abc123@example.com',
            }
          }
        },
        {
          id: 'event3',
          timestamp: 1710000300.8591378,
          event: 'opened',
          recipient: 'other@example.com',
          message: {
            headers: {
              'message-id': 'xyz789@example.com',
            }
          }
        }
      ]
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // When
    const result = await listEmailEventsHandler({
      domain: 'example.com',
      event: 'opened',
      limit: 50,
      beginSearchPeriod: '2024-03-09T16:00:00Z',
      endSearchPeriod: '2024-03-09T17:00:00Z'
    });

    // Then
    const expectedText = [
      'The following events must be presented with ALL their data, even if the ID is long, it MUST be displayed as this information can be used to get subsequent information on other API endpoints.',
      'Found 2 email events for domain example.com (filtered by event: opened):',
      '**Message ID:** abc123@example.com',
      '| Event | Timestamp (UTC) |',
      '|-------|-----------------|',
      '| opened | 2024-03-09T16:03:20.745Z |',
      '',
      '**Message ID:** xyz789@example.com',
      '| Event | Timestamp (UTC) |',
      '|-------|-----------------|',
      '| opened | 2024-03-09T16:05:00.859Z |\n'
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
    const result = await listEmailEventsHandler({});

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
    const result = await listEmailEventsHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Failed to parse JSON response: Error: invalid json').promptResponse);
  });

  it('returns early on credential fetch error', async () => {
    // Given
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockResolvedValue(new PromptResponse('Missing credentials'));

    // When
    const result = await listEmailEventsHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Missing credentials').promptResponse);
  });
});
