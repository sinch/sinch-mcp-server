import { sendEmailHandler } from '../../../src/tools/email/send-email';
import { fetch } from 'undici';
import * as mailgunHelper from '../../../src/tools/email/utils/mailgun-service-helper';
import { PromptResponse } from '../../../src/types';

jest.mock('undici', () => ({
  fetch: jest.fn(),
  FormData: class {
    private fields: Record<string, string> = {};
    set(key: string, value: string) {
      this.fields[key] = value;
    }
  }
}));

describe('sendEmailHandler', () => {

  const mockCredentials = {
    domain: 'example.com',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockResolvedValue(mockCredentials);
  });

  it('sends an email with a body (no template)', async () => {
    // Given
    const mockJson = jest.fn().mockResolvedValue({ id: '<test-id-123.mailgun.org>' });
    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      json: mockJson
    });

    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Test Subject',
      body: '<p>Hello</p>'
    });

    // Then
    expect(result.content[0].text).toBe('Email sent to user@example.com with subject "Test Subject"! The message ID is <test-id-123.mailgun.org>');
  });

  it('sends an email using a template', async () => {
    // Given
    const mockJson = jest.fn().mockResolvedValue({ id: '<template-id-456.mailgun.org>' });
    (fetch as jest.Mock).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      json: mockJson
    });

    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Template Subject',
      template: 'welcome-email',
      templateVariables: { name: 'User' }
    });

    // Then
    expect(result.content[0].text).toBe('Email sent to user@example.com with subject "Template Subject"! The message ID is <template-id-456.mailgun.org>');
  });

  it('fails when no body or template is provided', async () => {
    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Missing Content'
    });

    // Then
    expect(result.content[0].text).toBe('The "body" is not provided and no template name is specified.');
  });

  it('handles Mailgun API error', async () => {
    // Given
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Test Subject',
      body: '<p>Hello</p>'
    });

    // Then
    expect(result).toEqual(new PromptResponse('An error occurred when trying to send the email: {"ok":false,"status":403,"statusText":"Forbidden"} The status code is 403: Forbidden.').promptResponse);
  });

  it('returns early on credential fetch error', async () => {
    // Given
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockResolvedValue(new PromptResponse('Missing credentials'));

    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Test Subject',
      body: '<p>Hello</p>'
    });

    // Then
    expect(result).toEqual(new PromptResponse('Missing credentials').promptResponse);
  });

});
