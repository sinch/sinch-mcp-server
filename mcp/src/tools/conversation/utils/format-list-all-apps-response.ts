import { Conversation } from '@sinch/sdk-core';

export const formatListAllAppsResponse = (response: Conversation.ListAppsResponse) => {
  return {
    apps: response.apps?.map(app => ({
      id: app.id,
      display_name: app.display_name,
      channel_credentials: app.channel_credentials
        ?.filter(cred => cred.state?.status === 'ACTIVE')
        .map(cred => ({
        channel: cred.channel
      }))
    }))
  };
};
