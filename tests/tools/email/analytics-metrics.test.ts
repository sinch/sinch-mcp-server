import { analyticsMetricsHandler } from '../../../src/tools/email/analytics-metrics';
import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';
import { USER_AGENT } from '../../../src/user-agent';
import { sha256 } from '../../../src/tools/email/utils/mailgun-tools-helper';

global.fetch = jest.fn();

describe('analyticsMetricsHandler', () => {
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunApiKey').mockReturnValue(mockApiKey);
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

    const mockedFetch = fetch as jest.Mock;
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // When
    const result = await analyticsMetricsHandler({});

    // Then
    const expectedText = [
      'The following data must be presented graphically. Mailgun Analytics Metrics for domain "all":',
      '',
      '{"metrics":{"accepted_count":10,"delivered_count":8,"failed_count":2,"opened_count":5,"clicked_count":3,"unsubscribed_count":1,"complained_count":0}}'
    ].join('\n');
    expect(result.role).toBe('assistant');
    expect(result.content[0].text).toBe(expectedText);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_url, options] = mockedFetch.mock.calls[0];
    expect(options?.method).toBe('POST');
    const encodedAuth = 'Basic ' + Buffer.from(`api:${mockApiKey}`).toString('base64');
    expect(options?.headers).toMatchObject({
      Authorization: encodedAuth,
      'Content-Type': 'application/json',
    });
    const apiKeyHash = '4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4';
    expect(sha256(mockApiKey)).toBe(apiKeyHash);
    const expectedUserAgent = USER_AGENT.replace('{toolName}', 'analytics-metrics').replace('{projectId}', apiKeyHash);
    expect((options?.headers as any)['User-Agent']).toBe(expectedUserAgent);
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
    jest.spyOn(mailgunHelper, 'getMailgunApiKey').mockReturnValue(new PromptResponse('Missing API key'));

    // When
    const result = await analyticsMetricsHandler({});

    // Then
    expect(result).toEqual(new PromptResponse('Missing API key').promptResponse);
  });
});
