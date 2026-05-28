import { z } from 'zod';
import { SupportedConversationRegion } from '@sinch/sdk-client';

export const Recipient = z.string()
  .describe('(Required) The recipient to send the message to. This can be a phone number in E.164 format, or the identifier for the specified channel such as Messenger.');

export const ChannelEnum = z.enum([
  'WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBERBM',
  'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT',
  'LINE', 'WECHAT', 'APPLEBC'
]);

export const ConversationChannel = z.array(ChannelEnum).nonempty()
  .describe('(Required) The channel to use for sending the message.')

export const ConversationAppIdOverride = z.string().optional()
  .describe('(Optional) The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable "CONVERSATION_APP_ID".')

export const ConversationAppId = z.string()
  .describe('The Conversation API app ID. Use list-conversation-apps to find existing app IDs.')

export const MessageSenderNumberOverride = z.string().optional()
  .describe('(Optional) The phone number of the message\'s sender (E.164 format). If set, it will override the value from the environment variable "DEFAULT_SMS_ORIGINATOR".')

const supportedRegions = Object.values(SupportedConversationRegion) as [string, ...string[]];
export const ConversationRegionOverride = z.enum([...supportedRegions, '']).optional()
  .describe('(Optional) The region to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_REGION.')

export const TextMessage = z.string()
  .describe('(Required) The text to send.')

export const WebhookId = z.string()
  .describe('(Required) The ID of the webhook. You can obtain it from list-webhooks or the Sinch Dashboard.')

export const WebhookTarget = z.string()
  .describe('(Required) The HTTPS URL where Conversation API events should be delivered. Maximum length is 742 characters.')

const webhookTriggerValues = [
  'MESSAGE_DELIVERY',
  'MESSAGE_SUBMIT',
  'MESSAGE_INBOUND',
  'EVENT_DELIVERY',
  'EVENT_INBOUND',
  'SMART_CONVERSATIONS',
  'MESSAGE_INBOUND_SMART_CONVERSATION_REDACTION',
  'CONVERSATION_START',
  'CONVERSATION_STOP',
  'CONVERSATION_DELETE',
  'CONTACT_CREATE',
  'CONTACT_DELETE',
  'CONTACT_MERGE',
  'CONTACT_UPDATE',
  'CONTACT_IDENTITIES_DUPLICATION',
  'OPT_IN',
  'OPT_OUT',
  'CHANNEL_EVENT',
  'CAPABILITY',
  'RECORD_NOTIFICATION',
] as const;

export const WebhookTriggers = z.array(z.enum(webhookTriggerValues)).optional()
  .describe('(Optional) Event triggers that activate this webhook. Omit to leave without triggers, or pass an empty array [] to clear all triggers on update. Use update-webhook to add triggers later.')

export const WebhookTargetOptional = WebhookTarget.optional()
  .describe('(Optional) The HTTPS URL where Conversation API events should be delivered.')
