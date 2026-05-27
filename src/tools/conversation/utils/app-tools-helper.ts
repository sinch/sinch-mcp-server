import { Conversation } from '@sinch/conversation';
import { ConversationService } from '@sinch/conversation';
import { IPromptResponse, PromptResponse } from '../../../types';
import { formatAppResponse } from './format-app-response';
import { mergeChannelCredentials } from './build-channel-credential';

export const appendRegionHint = (error: unknown, region: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `${message} If the resource cannot be found, the region parameter may be incorrect. Current region: ${region}.`;
};

export const addChannelToApp = async (
  conversationService: ConversationService,
  usedRegion: string,
  appId: string,
  credential: Conversation.ConversationChannelCredentialRequest,
): Promise<IPromptResponse> => {
  try {
    const existingApp = await conversationService.app.get({ app_id: appId });
    const channelCredentials = mergeChannelCredentials(
      existingApp.channel_credentials,
      credential,
    );

    const response = await conversationService.app.update({
      app_id: appId,
      update_mask: ['channel_credentials'],
      appUpdateRequestBody: {
        channel_credentials: channelCredentials,
      },
    });

    return new PromptResponse(JSON.stringify({
      success: true,
      region: usedRegion,
      app: formatAppResponse(response),
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
