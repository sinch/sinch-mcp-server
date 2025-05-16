import { SessionMailgunCredentials } from '../../types.js';

export const getMailgunCredentials = async (domain: string | undefined): Promise<SessionMailgunCredentials> => {

  let credentials;

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
    if (!mailgunDomain) {
      errorMessage += '"MAILGUN_API_KEY" is not set in the environment variables.';
    }
    return {
      promptResponse: {
        content: [
          {
            type: 'text',
            text: errorMessage
          }
        ]
      }
    };
  }

  return credentials;

};
