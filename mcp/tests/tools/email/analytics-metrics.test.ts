import { analyticsMetricsHandler } from '../../../src/tools/email/analytics-metrics';
import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';

global.fetch = jest.fn();

describe('analyticsMetricsHandler', () => {
  const mockCredentials = {
    domain: 'example.com',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(mockCredentials);
  });

  it('returns metrics data in prompt response', async () => {
    // Given
    const mockResponse = {
      start: 'Mon, 02 Jun 2025 00:00:00 +0000',
      end: 'Mon, 09 Jun 2025 00:00:00 +0000',
      resolution: 'day',
      dimensions: [
        'time'
      ],
      items: [],
      aggregates: {
        metrics: {
          accepted_count: 10,
          delivered_count: 8,
          failed_count: 2,
          opened_count: 5,
          clicked_count: 3,
          unsubscribed_count: 1,
          complained_count: 0
        }
      }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // When
    const result = await analyticsMetricsHandler({});

    // Then
    const expectedText = '{"metrics":{"accepted_count":10,"delivered_count":8,"failed_count":2,"opened_count":5,"clicked_count":3,"unsubscribed_count":1,"complained_count":0}}';
    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedText);
  });

  it('handles Mailgun API error gracefully', async () => {
    // Given
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    // When
    const result = await analyticsMetricsHandler({
      domain: 'testdomain.com',
    });

    // Then
    expect(result).toEqual(new PromptResponse('Mailgun API error: 403 Forbidden').promptResponse);
  });

  it('handles JSON parse error', async () => {
    // Given
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('Unexpected token'); }
    });

    // When
    const result = await analyticsMetricsHandler({
      domain: 'testdomain.com',
    });

    // Then
    expect(result).toEqual(new PromptResponse('Failed to parse JSON response: Error: Unexpected token').promptResponse);
  });

  it('returns early on credential fetch error', async () => {
    // Given
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(new PromptResponse('Missing credentials'));

    // When
    const result = await analyticsMetricsHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Missing credentials').promptResponse);
  });
});
