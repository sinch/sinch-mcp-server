import { Conversation } from '@sinch/conversation';

type ChannelCredentialBase = {
  callbackSecret?: string;
};

export const buildSmsChannelCredential = (
  servicePlanId: string,
  apiToken: string,
  options: ChannelCredentialBase = {}
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'SMS',
  ...(options.callbackSecret && { callback_secret: options.callbackSecret }),
  static_bearer: {
    claimed_identity: servicePlanId,
    token: apiToken,
  },
});

export const buildRcsChannelCredential = (
  senderId: string,
  bearerToken: string,
  options: ChannelCredentialBase = {}
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'RCS',
  ...(options.callbackSecret && { callback_secret: options.callbackSecret }),
  static_bearer: {
    claimed_identity: senderId,
    token: bearerToken,
  },
});

export const buildWhatsAppChannelCredential = (
  senderId: string,
  bearerToken: string,
  options: ChannelCredentialBase = {}
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'WHATSAPP',
  ...(options.callbackSecret && { callback_secret: options.callbackSecret }),
  static_bearer: {
    claimed_identity: senderId,
    token: bearerToken,
  },
});

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
