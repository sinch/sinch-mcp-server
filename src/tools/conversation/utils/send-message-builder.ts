import { Conversation, ConversationService } from '@sinch/conversation';
import { env } from '../../../env';
import { appendRegionHint } from './region-hint';

// Thrown when a requested channel is not configured on the Conversation API app
// (e.g. trying to send over RCS when no RCS sender is assigned to the app).
export class ChannelNotConfiguredError extends Error {
  constructor(requested: string[], configured: string[]) {
    const missing = requested.join(', ');
    const available = configured.length > 0 ? configured.join(', ') : 'none';
    super(
      `The requested channel(s) [${missing}] are not configured on this Conversation API app. ` +
        `Configured channels: [${available}]. Assign the channel to the app first ` +
        `(e.g. set-rcs-channel-on-app / set-sms-channel-on-app / set-whatsapp-channel-on-app), or send on a configured channel.`,
    );
    this.name = 'ChannelNotConfiguredError';
  }
}

// A ChannelNotConfiguredError is actionable on its own, so the region hint is
// omitted — it would be misleading (the region is not the problem).
export const formatSendError = (error: unknown, region: string): string => {
  if (error instanceof ChannelNotConfiguredError) {
    return error.message;
  }
  return appendRegionHint(error, region);
};

export const buildMessageBase = async (
  conversationService: ConversationService,
  appId: string,
  recipient: string,
  channel: string[],
  sender?: string,
): Promise<Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message'>> => {
  const messageBase: Omit<Conversation.SendMessageRequest<Conversation.IdentifiedBy>, 'message' | 'recipient'> = {
    app_id: appId,
    processing_strategy: 'DISPATCH_ONLY',
  };

  const channelIdentities: Conversation.ChannelRecipientIdentity[] = [];
  const appConfiguration = await conversationService.app.get({ app_id: appId });
  const configuredChannels: string[] = appConfiguration.channel_credentials?.map((channel) => channel.channel) || [];
  const unconfiguredChannels: string[] = [];
  for (let c of channel) {
    if (c === 'MMS' && !configuredChannels.includes('MMS')) {
      // Fallback to SMS if MMS is not configured (the downgrade is always allowed)
      c = 'SMS';
    } else if (!configuredChannels.includes(c)) {
      // The requested channel has no credential on the app (e.g. RCS without an
      // assigned sender) — collect it so we can fail with an actionable error.
      unconfiguredChannels.push(c);
      continue;
    }
    channelIdentities.push({
      channel: c as Conversation.ConversationChannel,
      identity: recipient,
    });
  }

  if (unconfiguredChannels.length > 0) {
    throw new ChannelNotConfiguredError(unconfiguredChannels, configuredChannels);
  }

  addSMSFallback(appConfiguration, channel, recipient, channelIdentities);

  if (!sender) {
    sender = env.DEFAULT_SMS_ORIGINATOR;
  }
  if (sender) {
    messageBase.channel_properties = {
      SMS_SENDER: sender,
    };
  }

  return {
    ...messageBase,
    recipient: {
      identified_by: {
        channel_identities: channelIdentities,
      },
    },
  };
};

const addSMSFallback = (
  appConfiguration: Conversation.AppResponse,
  channels: string[],
  recipient: string,
  channelIdentities: Conversation.ChannelRecipientIdentity[],
) => {
  if (channels.includes('RCS') || channels.includes('WHATSAPP')) {
    const smsChannel = channels.find((c) => c === 'SMS');
    if (!smsChannel && isSMSChannelConfigured(appConfiguration)) {
      channelIdentities.push({
        channel: 'SMS',
        identity: recipient,
      });
    }
  }
};

const isSMSChannelConfigured = (appConfiguration: Conversation.AppResponse): boolean => {
  if (appConfiguration.channel_credentials) {
    const smsChannel = appConfiguration.channel_credentials.find((channel) => channel.channel === 'SMS');
    return !!smsChannel;
  }
  return false;
};
