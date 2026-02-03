import { listEmailEventsHandler } from '../../../src/tools/email/list-email-events';
import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';

global.fetch = jest.fn();

describe('listEmailEventsHandler', () => {
  const mockCredentials = {
    domain: 'example.com',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(mockCredentials);
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
    const expectedResponse = JSON.stringify({
      events: [
        {
          message_id: 'abc123@example.com',
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test Subject',
          events: [
            { event: 'accepted', timestamp: '2024-03-09T16:00:00.755Z' },
            { event: 'delivered', timestamp: '2024-03-09T16:01:40.163Z' },
            { event: 'opened', 'timestamp': '2024-03-09T16:03:20.745Z' }
          ],
        },
        {
          message_id: 'xyz789@example.com',
          events: [
            { event: 'opened', timestamp: '2024-03-09T16:05:00.859Z' }
          ],
        }
      ],
      total_count: 4,
    });

    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedResponse);
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
    const expectedResponse = JSON.stringify({
      events: [
        {
          message_id: 'abc123@example.com',
          events: [
            { 'event': 'opened', 'timestamp': '2024-03-09T16:03:20.745Z' }
          ],
        },
        {
          message_id: 'xyz789@example.com',
          events: [
            { event: 'opened', timestamp: '2024-03-09T16:05:00.859Z' }
          ],
        },
      ],
      total_count: 2
    });

    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedResponse);
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
    const expectedResponse = JSON.stringify({
      success: false,
      error: 'Mailgun API error: 403 Forbidden'
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
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
    const expectedResponse = JSON.stringify({
      success: false,
      error: 'invalid json'
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
  });

  it('returns early on credential fetch error', async () => {
    // Given
    const promptResponse = new PromptResponse(JSON.stringify({
      success: false,
      error: 'Missing credentials'
    }));
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(promptResponse);

    // When
    const result = await listEmailEventsHandler({});

    // Then
    expect(result).toEqual(promptResponse.promptResponse);
  });
});
