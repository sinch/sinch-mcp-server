import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  CONVERSATION_HOSTNAME,
  CONVERSATION_TEMPLATES_HOSTNAME,
  ConversationRegion,
  Oauth2TokenRequest,
  REGION_PATTERN,
  SinchClient,
  buildHeader,
} from '@sinch/sdk-core';
import process from 'process';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export function getConversationService(toolName: string): SinchClient | PromptResponse {
  return getSinchService(
    CONVERSATION_HOSTNAME,
    toolName,
    (client, fetcher, hostname) => configureConversationApis(client, fetcher, hostname),
  );
}

export function getConversationTemplateService(toolName: string): SinchClient | PromptResponse {
  return getSinchService(
    CONVERSATION_TEMPLATES_HOSTNAME,
    toolName,
    (client, fetcher, hostname) => configureTemplatesApis(client, fetcher, hostname),
  );
}

/** Shared helper for both “conversation” and “templates” */
function getSinchService(
  hostnameTemplate: string,
  toolName: string,
  configure: (client: SinchClient, fetcher: ApiFetchClient, hostname: string) => void
): SinchClient | PromptResponse {
  const projectId = process.env.CONVERSATION_PROJECT_ID;
  const keyId     = process.env.CONVERSATION_KEY_ID;
  const keySecret = process.env.CONVERSATION_KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(
      'Missing env vars: CONVERSATION_PROJECT_ID, CONVERSATION_KEY_ID, CONVERSATION_KEY_SECRET.'
    );
  }

  const client  = new SinchClient({});
  const fetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [
      new Oauth2TokenRequest(keyId, keySecret),
      new AdditionalHeadersRequest({
        headers: buildHeader(
          'User-Agent',
          formatUserAgent(toolName, projectId),
        ),
      }),
    ],
  });
  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();

  // Replace the region placeholder with US by default
  const hostname = hostnameTemplate.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  configure(client, fetcher, hostname);

  return client;
}

// Hack: ConversationDomainApi is not exposed
interface ApiService {
  client: ApiFetchClient;
  setHostname: (hostname: string) => void;
}

const addPropertiesToApi = (api: ApiService, client: ApiFetchClient, hostname: string) => {
  api.client = client;
  api.setHostname(hostname);
};

const configureConversationApis = (
  sinchClient: SinchClient,
  apiFetchClient: ApiFetchClient,
  hostnameTemplate: string
) => {
  const hostname = hostnameTemplate.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  const apis = [
    sinchClient.conversation.app,
    sinchClient.conversation.contact,
    sinchClient.conversation.conversation,
    sinchClient.conversation.messages,
    sinchClient.conversation.events,
    sinchClient.conversation.capability,
    sinchClient.conversation.transcoding,
    sinchClient.conversation.webhooks,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient, hostname));
};

const configureTemplatesApis = (
  sinchClient: SinchClient,
  apiFetchClient: ApiFetchClient,
  hostnameTemplate: string
) => {
  const hostname = hostnameTemplate.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  addPropertiesToApi(sinchClient.conversation.templatesV2 as unknown as ApiService, apiFetchClient, hostname);
};

export const getConversationAppId = (appId: string | undefined): string | PromptResponse => {
  if (!appId) {
    appId = process.env.CONVERSATION_APP_ID;
    if (!appId) {
      return new PromptResponse('The "CONVERSATION_APP_ID" is not set in the environment variables and the "appId" property is not provided.');
    }
  }
  return appId;
}

export const getConversationRegion = (region: string | undefined): string =>
  region ?? process.env.CONVERSATION_REGION ?? ConversationRegion.UNITED_STATES;
