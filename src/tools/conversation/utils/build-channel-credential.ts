import { Conversation } from '@sinch/conversation';

export const buildSmsChannelCredential = (
  servicePlanId: string,
  apiToken: string,
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'SMS',
  static_bearer: {
    claimed_identity: servicePlanId,
    token: apiToken,
  },
});

export const buildRcsChannelCredential = (
  senderId: string,
  bearerToken: string,
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'RCS',
  static_bearer: {
    claimed_identity: senderId,
    token: bearerToken,
  },
});

export const buildWhatsAppChannelCredential = (
  senderId: string,
  bearerToken: string,
): Conversation.ConversationChannelCredentialRequest => ({
  channel: 'WHATSAPP',
  static_bearer: {
    claimed_identity: senderId,
    token: bearerToken,
  },
});

export const mergeChannelCredentials = (
  existing: Conversation.ConversationChannelCredentialResponse[] | undefined,
  incoming: Conversation.ConversationChannelCredentialRequest,
): Conversation.ConversationChannelCredentialRequest[] => {
  const credentials = (existing ?? []).map(toChannelCredentialRequest);
  const index = credentials.findIndex((cred) => cred.channel === incoming.channel);
  if (index >= 0) {
    credentials[index] = incoming;
  } else {
    credentials.push(incoming);
  }
  return credentials;
};

const optionalRequestFields = (credential: Conversation.ConversationChannelCredentialResponse) => ({
  ...(credential.credential_ordinal_number !== undefined
    ? { credential_ordinal_number: credential.credential_ordinal_number }
    : {}),
  ...(credential.callback_secret !== undefined ? { callback_secret: credential.callback_secret } : {}),
});

// Every channel keeps its credential under exactly one of these keys, and the response
// shape for each one is identical to the request shape (see StaticBearerCredential,
// StaticTokenCredential, MMSCredentials, etc. in @sinch/conversation), so a passthrough
// copy is all that's needed. Add new channels here as the SDK adds them.
const CREDENTIAL_FIELDS = [
  'static_bearer',
  'static_token',
  'mms_credentials',
  'instagram_credentials',
  'telegram_credentials',
  'kakaotalk_credentials',
  'kakaotalkchat_credentials',
  'line_credentials',
  'line_enterprise_credentials',
  'wechat_credentials',
  'applebc_credentials',
] as const;

export const toChannelCredentialRequest = (
  credential: Conversation.ConversationChannelCredentialResponse,
): Conversation.ConversationChannelCredentialRequest => {
  const base = { channel: credential.channel, ...optionalRequestFields(credential) };
  const source = credential as unknown as Record<string, unknown>;

  for (const field of CREDENTIAL_FIELDS) {
    const value = source[field];
    if (value) {
      return { ...base, [field]: value } as Conversation.ConversationChannelCredentialRequest;
    }
  }

  return base as Conversation.ConversationChannelCredentialRequest;
};
