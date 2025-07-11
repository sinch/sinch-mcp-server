import { Conversation, SinchClient } from '@sinch/sdk-core';

export const buildMessageBase = async (
  sinchClient: SinchClient,
  appId: string,
  recipient: string,
  channel: string | string[],
  sender?: string
): Promise<Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message'>> => {

  const messageBase: Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message' | 'recipient'> = {
    app_id: appId,
    processing_strategy: 'DISPATCH_ONLY'
  };

  const channel_identities: Conversation.ChannelRecipientIdentity[] = [];
  const appConfiguration = await sinchClient.conversation.app.get({ app_id: appId });
  const configuredChannels: string[] = appConfiguration.channel_credentials?.map(channel => channel.channel) || [];
  for (let c of (Array.isArray(channel) ? channel : [channel])) {
    if (c === 'MMS' && !configuredChannels.includes('MMS')) {
      // Fallback to SMS if MMS is not configured
      c = 'SMS';
    }
    channel_identities.push({
      channel: c as Conversation.ConversationChannel,
      identity: recipient
    });
  }

  addSMSFallback(appConfiguration, channel, recipient, channel_identities);

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

// This function adds an SMS fallback for RCS or WHATSAPP if the channel is RCS or WHATSAPP and SMS is not already included in the channel_identities
const addSMSFallback = (
  appConfiguration: Conversation.AppResponse,
  channel: string | string[],
  recipient: string,
  channel_identities: Conversation.ChannelRecipientIdentity[]
) => {
  const channels = Array.isArray(channel) ? channel : [channel];
  if (channels.includes('RCS') || channels.includes('WHATSAPP')) {
    const smsChannel = channels.find(c => c === 'SMS');
    if (!smsChannel && isSMSChannelConfigured(appConfiguration)) {
      channel_identities.push({
        channel: 'SMS',
        identity: recipient
      });
    }
  }
};

const isSMSChannelConfigured = (appConfiguration: Conversation.AppResponse): boolean => {
  if (appConfiguration.channel_credentials) {
    const smsChannel = appConfiguration.channel_credentials.find(channel => channel.channel === 'SMS');
    return !!smsChannel;
  }
  return false;
};
