import { Conversation } from '@sinch/conversation';

export const formatAppResponse = (app: Conversation.AppResponse | undefined) => {
  if (!app) {
    return {};
  }
  return {
    id: app.id,
    display_name: app.display_name,
    processing_mode: app.processing_mode,
    channel_credentials: app.channel_credentials?.map(cred => ({
      channel: cred.channel,
      status: cred.state?.status,
      channel_known_id: cred.channel_known_id,
      ...('static_bearer' in cred && cred.static_bearer?.claimed_identity !== undefined
        ? { claimed_identity: cred.static_bearer.claimed_identity }
        : {}),
    })),
  };
};
