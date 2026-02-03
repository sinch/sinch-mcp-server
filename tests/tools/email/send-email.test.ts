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
    jest.spyOn(mailgunHelper, 'getMailgunCredentials').mockReturnValue(mockCredentials);
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
    const expectedResponse = JSON.stringify({
      success: true,
      message_id: '<test-id-123.mailgun.org>',
      recipient: 'user@example.com',
      subject: 'Test Subject'
    })
    expect(result.content[0].text).toBe(expectedResponse);
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
    const expectedResponse = JSON.stringify({
      success: true,
      message_id: '<template-id-456.mailgun.org>',
      recipient: 'user@example.com',
      subject: 'Template Subject'
    });
    expect(result.content[0].text).toBe(expectedResponse);
  });

  it('fails when no body or template is provided', async () => {
    // When
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Missing Content'
    });

    // Then
    const expectedResponse = JSON.stringify({
      success: false,
      error: 'The "body" is not provided and no template name is specified.'
    });
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
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Test Subject',
      body: '<p>Hello</p>'
    });

    // Then
    const expectedResponse = JSON.stringify({
      success: false,
      error: {
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      }
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
    const result = await sendEmailHandler({
      sender: 'sender@example.com',
      recipient: 'user@example.com',
      subject: 'Test Subject',
      body: '<p>Hello</p>'
    });

    // Then
    expect(result).toEqual(promptResponse.promptResponse);
  });

});
