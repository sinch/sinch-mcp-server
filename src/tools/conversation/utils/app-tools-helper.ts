import { Conversation } from '@sinch/conversation';
import { ConversationService } from '@sinch/conversation';
import { IPromptResponse, PromptResponse } from '../../../types';
import { appendRegionHint } from './region-hint';
import { formatAppResponse } from './format-app-response';
import { mergeChannelCredentials } from './build-channel-credential';

export const addChannelToApp = async (
  conversationService: ConversationService,
  usedRegion: string,
  appId: string,
  credential: Conversation.ConversationChannelCredentialRequest,
): Promise<IPromptResponse> => {
  try {
    const existingApp = await conversationService.app.get({ app_id: appId });
    const channelCredentials = mergeChannelCredentials(existingApp.channel_credentials, credential);

    const response = await conversationService.app.update({
      app_id: appId,
      appUpdateRequestBody: {
        channel_credentials: channelCredentials,
      },
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        app: formatAppResponse(response),
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: appendRegionHint(error, usedRegion),
      }),
    ).promptResponse;
  }
};
