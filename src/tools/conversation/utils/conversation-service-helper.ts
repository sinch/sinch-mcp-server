import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  CONVERSATION_HOSTNAME,
  CONVERSATION_TEMPLATES_HOSTNAME,
  ConversationRegion,
  formatRegionalizedHostname,
  Oauth2TokenRequest,
  REGION_PATTERN,
} from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import process from 'process';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export const getConversationService = (toolName: string): ConversationService | PromptResponse => {
  const projectId = process.env.PROJECT_ID;
  const keyId     = process.env.KEY_ID;
  const keySecret = process.env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(
      'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'
    );
  }

  const conversationService  = new ConversationService({});
  const authenticationPlugin = new Oauth2TokenRequest(keyId, keySecret);
  const additionalHeadersPlugin = new AdditionalHeadersRequest({
    headers: buildHeader(
      'User-Agent',
      formatUserAgent(toolName, projectId),
    ),
  });

  const fetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [
      authenticationPlugin,
      additionalHeadersPlugin,
    ],
  });
  const templateFetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [
      authenticationPlugin,
      additionalHeadersPlugin,
    ],
  });

  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  templateFetcher.apiClientOptions.requestPlugins?.shift();

  // Replace the region placeholder with US by default
  fetcher.apiClientOptions.hostname
    = CONVERSATION_HOSTNAME.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);
  templateFetcher.apiClientOptions.hostname
    = CONVERSATION_TEMPLATES_HOSTNAME.replace(REGION_PATTERN, `${ConversationRegion.UNITED_STATES}.`);

  conversationService.lazyConversationClient.apiFetchClient = fetcher;
  conversationService.lazyConversationTemplateClient.apiFetchClient = templateFetcher;

  return conversationService;
}

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
  conversationService.lazyConversationClient.sharedConfig.conversationRegion = region;
  const formattedRegion = region !== '' ? `${region}.` : '';
  conversationService.lazyConversationClient.apiFetchClient!.apiClientOptions.hostname
    = formatRegionalizedHostname(CONVERSATION_HOSTNAME, formattedRegion);
  return region;
}

export const setTemplateRegion = (promptRegion: string | undefined, conversationService: ConversationService) => {
  const region = promptRegion ?? process.env.CONVERSATION_REGION ?? ConversationRegion.UNITED_STATES;
  conversationService.lazyConversationTemplateClient.sharedConfig.conversationRegion = region;
  const formattedRegion = region !== '' ? `${region}.` : '';
  conversationService.lazyConversationTemplateClient.apiFetchClient!.apiClientOptions.hostname
    = formatRegionalizedHostname(CONVERSATION_TEMPLATES_HOSTNAME, formattedRegion);
  return region;
}
