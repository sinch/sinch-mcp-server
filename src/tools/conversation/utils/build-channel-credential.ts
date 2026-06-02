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
  incoming: Conversation.ConversationChannelCredentialRequest
): Conversation.ConversationChannelCredentialRequest[] => {
  const credentials = (existing ?? []).map(toChannelCredentialRequest);
  const index = credentials.findIndex(cred => cred.channel === incoming.channel);
  if (index >= 0) {
    credentials[index] = incoming;
  } else {
    credentials.push(incoming);
  }
  return credentials;
};

const optionalRequestFields = (
  credential: Conversation.ConversationChannelCredentialResponse
) => ({
  ...(credential.credential_ordinal_number !== undefined
    ? { credential_ordinal_number: credential.credential_ordinal_number }
    : {}),
  ...(credential.callback_secret !== undefined
    ? { callback_secret: credential.callback_secret }
    : {}),
});

export const toChannelCredentialRequest = (
  credential: Conversation.ConversationChannelCredentialResponse
): Conversation.ConversationChannelCredentialRequest => {
  const optional = optionalRequestFields(credential);

  if ('static_bearer' in credential && credential.static_bearer) {
    return {
      channel: credential.channel,
      ...optional,
      static_bearer: {
        claimed_identity: credential.static_bearer.claimed_identity,
        token: credential.static_bearer.token,
      },
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('static_token' in credential && credential.static_token) {
    return {
      channel: credential.channel,
      ...optional,
      static_token: {
        token: credential.static_token.token,
      },
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('mms_credentials' in credential && credential.mms_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      mms_credentials: credential.mms_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('instagram_credentials' in credential && credential.instagram_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      instagram_credentials: credential.instagram_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('telegram_credentials' in credential && credential.telegram_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      telegram_credentials: credential.telegram_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('kakaotalk_credentials' in credential && credential.kakaotalk_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      kakaotalk_credentials: credential.kakaotalk_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('kakaotalkchat_credentials' in credential && credential.kakaotalkchat_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      kakaotalkchat_credentials: credential.kakaotalkchat_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('line_credentials' in credential && credential.line_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      line_credentials: credential.line_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('line_enterprise_credentials' in credential && credential.line_enterprise_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      line_enterprise_credentials: credential.line_enterprise_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('wechat_credentials' in credential && credential.wechat_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      wechat_credentials: credential.wechat_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }
  if ('applebc_credentials' in credential && credential.applebc_credentials) {
    return {
      channel: credential.channel,
      ...optional,
      applebc_credentials: credential.applebc_credentials,
    } as Conversation.ConversationChannelCredentialRequest;
  }

  return {
    channel: credential.channel,
    ...optional,
  } as Conversation.ConversationChannelCredentialRequest;
};
