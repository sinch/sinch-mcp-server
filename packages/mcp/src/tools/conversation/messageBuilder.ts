import { Conversation } from '@sinch/sdk-core';

export const buildMessageBase = (
  appId: string,
  contact: string,
  channel: string
): Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message'> => {

  const messageBase: Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message' | 'recipient'> = {
    app_id: appId,
    processing_strategy: 'DISPATCH_ONLY'
  };

  const channel_identities: Conversation.ChannelRecipientIdentity[] = [
    {
      channel: channel as Conversation.ConversationChannel,
      identity: contact
    }
  ];

  if (channel === 'RCS') {
    channel_identities.push({
      channel: 'SMS',
      identity: contact
    });
  }

  return {
    ...messageBase,
    recipient: {
      identified_by: {
        channel_identities
      }
    }
  };

}
