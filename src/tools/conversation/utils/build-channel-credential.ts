import { Conversation } from '@sinch/conversation';
import { z } from 'zod';
import { ChannelEnum } from '../prompt-schemas';

export type ChannelCredentialInput = {
  channel: z.infer<typeof ChannelEnum>;
  smsServicePlanId?: string;
  smsApiToken?: string;
  bearerToken?: string;
  bearerClaimedIdentity?: string;
  pageAccessToken?: string;
  callbackSecret?: string;
};

export const buildChannelCredential = (
  input: ChannelCredentialInput
): Conversation.ConversationChannelCredentialRequest => {
  const base = input.callbackSecret
    ? { callback_secret: input.callbackSecret }
    : {};

  switch (input.channel) {
    case 'SMS': {
      if (!input.smsServicePlanId || !input.smsApiToken) {
        throw new Error(
          'SMS channel requires "smsServicePlanId" (service plan ID) and "smsApiToken" (API token).'
        );
      }
      return {
        channel: 'SMS',
        ...base,
        static_bearer: {
          claimed_identity: input.smsServicePlanId,
          token: input.smsApiToken,
        },
      };
    }
    case 'WHATSAPP':
    case 'RCS':
    case 'VIBERBM': {
      if (!input.bearerToken || !input.bearerClaimedIdentity) {
        throw new Error(
          `"${input.channel}" channel requires "bearerToken" and "bearerClaimedIdentity".`
        );
      }
      return {
        channel: input.channel,
        ...base,
        static_bearer: {
          claimed_identity: input.bearerClaimedIdentity,
          token: input.bearerToken,
        },
      };
    }
    case 'MESSENGER': {
      if (!input.pageAccessToken) {
        throw new Error('MESSENGER channel requires "pageAccessToken".');
      }
      return {
        channel: 'MESSENGER',
        ...base,
        static_token: {
          token: input.pageAccessToken,
        },
      };
    }
    default:
      throw new Error(
        `Channel "${input.channel}" is not supported by this tool. Supported channels: SMS, WHATSAPP, RCS, MESSENGER, VIBERBM.`
      );
  }
};

export const mergeChannelCredentials = (
  existing: Conversation.ConversationChannelCredentialResponse[] | undefined,
  incoming: Conversation.ConversationChannelCredentialRequest
): Conversation.ConversationChannelCredentialRequest[] => {
  const credentials = (existing ?? []).map(stripChannelCredentialForUpdate);
  const index = credentials.findIndex(cred => cred.channel === incoming.channel);
  if (index >= 0) {
    credentials[index] = incoming;
  } else {
    credentials.push(incoming);
  }
  return credentials;
};

const stripChannelCredentialForUpdate = (
  credential: Conversation.ConversationChannelCredentialResponse
): Conversation.ConversationChannelCredentialRequest => {
  const { state, channel_known_id, ...requestFields } = credential;
  return requestFields;
};
