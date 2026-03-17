import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  CONVERSATION_HOSTNAME,
  CONVERSATION_TEMPLATES_HOSTNAME,
  ConversationRegion,
  Oauth2TokenRequest,
  REGION_PATTERN,
  buildHeader,
  formatRegionalizedHostname,
} from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import process from 'process';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export function getConversationService(toolName: string): ConversationService | PromptResponse {
  return getService(
    CONVERSATION_HOSTNAME,
    toolName,
    (client, fetcher, hostname) => configureConversationApis(client, fetcher, hostname),
  );
}

export function getConversationTemplateService(toolName: string): ConversationService | PromptResponse {
  return getService(
    CONVERSATION_TEMPLATES_HOSTNAME,
    toolName,
    (client, fetcher, hostname) => configureTemplatesApis(client, fetcher, hostname),
  );
}

/** Shared helper for both “conversation” and “templates” */
function getService(
  hostnameTemplate: string,
  toolName: string,
  configure: (conversationService: ConversationService, fetcher: ApiFetchClient, hostname: string) => void
): ConversationService | PromptResponse {
  const projectId = process.env.PROJECT_ID;
  const keyId     = process.env.KEY_ID;
  const keySecret = process.env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(
      'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'
    );
  }

  const client  = new ConversationService({});
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
  conversationService: ConversationService,
  apiFetchClient: ApiFetchClient,
  hostnameTemplate: string
) => {
  const hostname = hostnameTemplate.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  const apis = [
    conversationService.app,
    conversationService.contact,
    conversationService.conversation,
    conversationService.messages,
    conversationService.events,
    conversationService.capability,
    conversationService.transcoding,
    conversationService.webhooks,
  ];

  apis.forEach((api) => addPropertiesToApi(api as unknown as ApiService, apiFetchClient, hostname));
};

const configureTemplatesApis = (
  conversationService: ConversationService,
  apiFetchClient: ApiFetchClient,
  hostnameTemplate: string
) => {
  const hostname = hostnameTemplate.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  addPropertiesToApi(conversationService.templatesV2 as unknown as ApiService, apiFetchClient, hostname);
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

export const setConversationRegion = (promptRegion: string | undefined, conversationService: ConversationService) => {
  const region = promptRegion ?? process.env.CONVERSATION_REGION ?? ConversationRegion.UNITED_STATES;
  conversationService.setRegion(region);
  const formattedRegion = region !== '' ? `${region}.` : '';
  const hostname = formatRegionalizedHostname(CONVERSATION_HOSTNAME, formattedRegion);
  (conversationService.messages as any).client.apiClientOptions.hostname = hostname;
  (conversationService.messages as any).sinchClientParameters.conversationHostname = hostname;
  (conversationService.app as any).client.apiClientOptions.hostname = hostname;
  (conversationService.app as any).sinchClientParameters.conversationHostname = hostname;
  return region;
}

export const setTemplateRegion = (promptRegion: string | undefined, conversationService: ConversationService) => {
  const region = promptRegion ?? process.env.CONVERSATION_REGION ?? ConversationRegion.UNITED_STATES;
  conversationService.setRegion(region);
  const formattedRegion = region !== '' ? `${region}.` : '';
  const hostname = formatRegionalizedHostname(CONVERSATION_TEMPLATES_HOSTNAME, formattedRegion);
  (conversationService.templatesV2 as any).client.apiClientOptions.hostname = hostname;
  (conversationService.templatesV2 as any).sinchClientParameters.conversationTemplatesHostname = hostname;
  return region;
}
