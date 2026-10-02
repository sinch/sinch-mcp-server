import {
  AdditionalHeadersRequest,
  ApiFetchClient,
  buildHeader,
  CONVERSATION_HOSTNAME,
  CONVERSATION_TEMPLATES_HOSTNAME,
  ConversationRegion,
  formatRegionalizedHostname,
  REGION_PATTERN,
  SupportedConversationRegion,
} from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import { getHttpCredentialSource } from '../../../auth/http-credential-mode';
import { getSharedOauth2TokenRequest } from '../../../auth/oauth-token-cache';
import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { env } from '../../../env';
import { PromptResponse } from '../../../types';
import { formatUserAgent } from '../../../utils';

export const resolveConversationRegion = (promptRegion: string | undefined): string => {
  // Multi-tenant HTTP: the region is pinned by the deployment (one deployment per region)
  // and must neither be overridable per request nor fall back to a default region.
  if (getHttpCredentialSource() === 'request-header') {
    const region = env.CONVERSATION_REGION;
    if (!region) {
      throw new Error('CONVERSATION_REGION must be set in multi-tenant mode; no default region is applied.');
    }
    return region;
  }
  return promptRegion ?? env.CONVERSATION_REGION ?? ConversationRegion.UNITED_STATES;
};

export const resolveConversationRegionsToList = (): string[] => {
  if (getHttpCredentialSource() === 'request-header') {
    return [resolveConversationRegion(undefined)];
  }
  return Object.values(SupportedConversationRegion);
};

export const getConversationService = (toolName: string): ConversationService | PromptResponse => {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (maybeCredentials instanceof PromptResponse) {
    return maybeCredentials;
  }
  const { projectId } = maybeCredentials;

  const conversationService = new ConversationService({});
  const authenticationPlugin = getSharedOauth2TokenRequest(maybeCredentials);
  const additionalHeadersPlugin = new AdditionalHeadersRequest({
    headers: buildHeader('User-Agent', formatUserAgent(toolName, projectId)),
  });

  const fetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [authenticationPlugin, additionalHeadersPlugin],
  });
  const templateFetcher = new ApiFetchClient({
    projectId,
    requestPlugins: [authenticationPlugin, additionalHeadersPlugin],
  });

  // Remove the VersionRequest plugin, as we override the user-agent header
  fetcher.apiClientOptions.requestPlugins?.shift();
  templateFetcher.apiClientOptions.requestPlugins?.shift();

  // Replace the region placeholder with the resolved region (env-pinned in multi-tenant mode,
  // env value or US default otherwise)
  const defaultRegion = resolveConversationRegion(undefined);
  fetcher.apiClientOptions.hostname = CONVERSATION_HOSTNAME.replace(REGION_PATTERN, `${defaultRegion}.`);
  templateFetcher.apiClientOptions.hostname = CONVERSATION_TEMPLATES_HOSTNAME.replace(
    REGION_PATTERN,
    `${defaultRegion}.`,
  );

  conversationService.lazyConversationClient.apiFetchClient = fetcher;
  conversationService.lazyConversationTemplateClient.apiFetchClient = templateFetcher;

  return conversationService;
};

export const getConversationAppId = (appId: string | undefined): string | PromptResponse => {
  if (!appId) {
    appId = env.CONVERSATION_APP_ID;
    if (!appId) {
      return new PromptResponse(
        'The "CONVERSATION_APP_ID" is not set in the environment variables and the "appId" property is not provided.',
      );
    }
  }
  return appId;
};

export const setConversationRegion = (promptRegion: string | undefined, conversationService: ConversationService) => {
  const region = resolveConversationRegion(promptRegion);
  conversationService.lazyConversationClient.sharedConfig.conversationRegion = region;
  const formattedRegion = region !== '' ? `${region}.` : '';
  conversationService.lazyConversationClient.apiFetchClient!.apiClientOptions.hostname = formatRegionalizedHostname(
    CONVERSATION_HOSTNAME,
    formattedRegion,
  );
  return region;
};

export const setTemplateRegion = (promptRegion: string | undefined, conversationService: ConversationService) => {
  const region = resolveConversationRegion(promptRegion);
  conversationService.lazyConversationTemplateClient.sharedConfig.conversationRegion = region;
  const formattedRegion = region !== '' ? `${region}.` : '';
  conversationService.lazyConversationTemplateClient.apiFetchClient!.apiClientOptions.hostname =
    formatRegionalizedHostname(CONVERSATION_TEMPLATES_HOSTNAME, formattedRegion);
  return region;
};
