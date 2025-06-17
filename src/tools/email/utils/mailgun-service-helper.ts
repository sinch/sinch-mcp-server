import { PromptResponse } from '../../../types';

export type MailgunCredentials = {
  domain: string;
  apiKey: string;
}

// TODO: Replace this method with a getMailgunService() method that will return the SinchClient once the Mailgun service is implemented.
export const getMailgunCredentials = (domain: string | undefined): MailgunCredentials | PromptResponse => {

  let credentials: MailgunCredentials | undefined = undefined;

  const mailgunDomain = domain || process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;

  if (mailgunDomain && apiKey) {
    credentials = {
      domain: mailgunDomain,
      apiKey: apiKey
    };
  }

  if (!mailgunDomain || !credentials) {
    let errorMessage = '';
    if (!mailgunDomain) {
      errorMessage = 'The "domain" is not provided and "MAILGUN_DOMAIN" is not set in the environment variables.';
    }
    if (!apiKey) {
      errorMessage += '"MAILGUN_API_KEY" is not set in the environment variables. The property is required to use the emails related tools.';
    }
    return new PromptResponse(errorMessage);
  }

  return credentials;

};

export const getMailgunApiKey = (): string | PromptResponse => {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    return new PromptResponse('The "MAILGUN_API_KEY" environment variable is not set. The property is required to use the emails related tools.');
  }

  return apiKey;
}
