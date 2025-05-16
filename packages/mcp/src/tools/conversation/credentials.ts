import crypto from 'crypto';
import {
  ApiFetchClient,
  ApiTokenRequest,
  CONVERSATION_HOSTNAME,
  ConversationRegion,
  REGION_PATTERN,
  SinchClient
} from '@sinch/sdk-core';
import { getCredential, SinchConversationCredentials, storeCredential } from '../../db-utils.js';
import { PromptResponse, SessionConversationCredentials } from '../../types';

const fetchToken = async (keyId: string, keySecret: string) => {
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://auth.sinch.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
  });

  return await response.json();
};

/**
 * Fetches the conversation credentials
 *  - 1: from the session storage (Authumn) if it exists
 *  - 2: generate a new token from the environment variables if they are defined (embedded version)
 *  - 3: if no sessionId is provided and no credentials can be generated from environment variables (SaaS version), return a prompt response to the user to authenticate
 * @param sessionId
 */
export const getConversationCredentials = async (sessionId: string | undefined): Promise<SessionConversationCredentials> => {

  const sid = sessionId || crypto.randomUUID();
  let credentials = getCredential(sid) as SinchConversationCredentials;

  if (!credentials) {
    const projectId = process.env.CONVERSATION_PROJECT_ID;
    const keyId = process.env.CONVERSATION_KEY_ID;
    const keySecret = process.env.CONVERSATION_KEY_SECRET;

    if (projectId && keyId && keySecret) {
      credentials = {
        projectId,
        token: await fetchToken(keyId, keySecret)
      };
      storeCredential(sid, 'conversation', credentials);
    }
  }

  if (!sessionId && !credentials) {
    return {
      sessionId: sid,
      promptResponse: {
        content: [
          {
            type: 'text',
            text: `The user has not authenticated yet. Please open a browser at http://localhost:3001/auth/conversation?sessionId=${sid}. For the next prompts from the user, always include the parameter "sessionId" with the value "${sid}".`
          }
        ]
      }
    };
  }

  return { ...credentials, sessionId: sid };
};

export const buildSinchClient = (credentials: SinchConversationCredentials) => {
  const sinchClient = new SinchClient({});
  const apiFetchClient = new ApiFetchClient({
    projectId: credentials.projectId,
    requestPlugins: [
      new ApiTokenRequest(credentials.token.access_token)
    ]
  });
  const hostname = CONVERSATION_HOSTNAME.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  addPropertiesToApi((sinchClient.conversation.app as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.contact as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.conversation as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.messages as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.events as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.capability as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.transcoding as unknown as ApiService), apiFetchClient, hostname);
  addPropertiesToApi((sinchClient.conversation.webhooks as unknown as ApiService), apiFetchClient, hostname);
  return sinchClient;
};

export const getConversationAppId = (appId: string | undefined): string | PromptResponse => {
  if (!appId) {
    appId = process.env.CONVERSATION_APP_ID;
    if (!appId) {
      return {
        content: [
          {
            type: 'text',
            text: 'The "appId" is not provided and CONVERSATION_APP_ID is not set in the environment variables.'
          }
        ]
      };
    }
  }
  return appId;
};

// Hack: ConversationDomainApi is not exposed
interface ApiService {
    client: ApiFetchClient;
    setHostname: (hostname: string) => void;
}

const addPropertiesToApi = (api: ApiService, client: ApiFetchClient, hostname: string) => {
  api.client = client;
  api.setHostname(hostname);
};
