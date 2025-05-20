import { Conversation } from '@sinch/sdk-core';

export const buildMessageBase = (
  appId: string,
  contact: string,
  channel: string,
  sender?: string
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

  if(!sender) {
    sender = process.env.DEFAULT_SMS_ORIGINATOR;
  }
  if (sender) {
    messageBase.channel_properties = {
      'SMS_SENDER': sender
    };
  }

  return {
    ...messageBase,
    recipient: {
      identified_by: {
        channel_identities
      }
    }
  };

};
