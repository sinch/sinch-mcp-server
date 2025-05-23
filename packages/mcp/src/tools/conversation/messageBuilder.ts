import { Conversation, SinchClient } from '@sinch/sdk-core';

export const buildMessageBase = async (
  sinchClient: SinchClient,
  appId: string,
  contact: string,
  channel: string | string[],
  sender?: string
): Promise<Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message'>> => {

  const messageBase: Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message' | 'recipient'> = {
    app_id: appId,
    processing_strategy: 'DISPATCH_ONLY'
  };

  const channel_identities: Conversation.ChannelRecipientIdentity[] = [];
  for (const c of (Array.isArray(channel) ? channel : [channel])) {
    channel_identities.push({
      channel: c as Conversation.ConversationChannel,
      identity: contact
    });
  }

  await addSMSFallbackForRCS(sinchClient, appId, channel, contact, channel_identities);

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

/// This function adds an SMS fallback for RCS if the channel is RCS and SMS is not already included in the channel_identities
const addSMSFallbackForRCS = async (
  sinchClient: SinchClient,
  appId: string,
  channel: string | string[],
  contact: string,
  channel_identities: Conversation.ChannelRecipientIdentity[]
) => {
  const channels = Array.isArray(channel) ? channel : [channel];
  if (channels.includes('RCS')) {
    const smsChannel = channels.find(c => c === 'SMS');
    if (!smsChannel && await isSMSChannelConfigured(sinchClient, appId)) {
      channel_identities.push({
        channel: 'SMS',
        identity: contact
      });
    }
  }
};

const isSMSChannelConfigured = async (sinchClient: SinchClient, appId: string): Promise<boolean> => {
  const applicationConfiguration = await sinchClient.conversation.app.get({ app_id: appId });
  if (applicationConfiguration.channel_credentials) {
    const smsChannel = applicationConfiguration.channel_credentials.find(channel => channel.channel === 'SMS');
    return !!smsChannel;
  }
  return false;
};
