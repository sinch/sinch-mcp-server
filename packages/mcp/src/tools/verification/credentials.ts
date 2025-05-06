import crypto from 'crypto';
import { getCredential, SinchVerificationCredentials } from '../../db-utils.js';
import { SessionVerificationCredentials } from '../../types';

export const getVerificationCredentials = async (sessionId: string | undefined): Promise<SessionVerificationCredentials> => {

  let credentials;

  const applicationKey = process.env.VERIFICATION_APPLICATION_KEY;
  const applicationSecret = process.env.VERIFICATION_APPLICATION_SECRET;

  // Check if we have credentials in the environment variables (embedded version)
  if (applicationKey && applicationSecret) {
    credentials = {
      appId: applicationKey,
      appSecret: applicationSecret
    };
  }

  console.error(JSON.stringify(credentials, null, 2));

  // If we are running the SaaS version, we need to get the credentials from the session
  const sid = sessionId || crypto.randomUUID();
  if (!credentials) {
    credentials = getCredential(sid) as SinchVerificationCredentials;
  }

  if (!sessionId && !credentials) {
    return {
      sessionId: sid,
      promptResponse: {
        content: [
          {
            type: 'text',
            text: `The user has not authenticated yet. Please open a browser at http://localhost:3001/auth/verification?sessionId=${sid}. For the next prompts from the user, always include the parameter "sessionId" with the value "${sid}".`
          }
        ]
      }
    };
  }

  return { ...credentials, sessionId: sid };
};
