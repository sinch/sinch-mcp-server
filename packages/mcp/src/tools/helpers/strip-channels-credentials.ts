import { Conversation } from '@sinch/sdk-core';

export const stripChannelsCredentials = (response: Conversation.ListAppsResponse) => {
  return {
    apps: response.apps?.map(app => ({
      ...app,
      channel_credentials: app.channel_credentials?.map(cred => ({
        channel: cred.channel
      }))
    }))
  };
};
