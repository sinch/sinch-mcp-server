import { z } from 'zod';

export const Recipient = z.string()
  .describe('(Required) The recipient to send the message to. This can be a phone number in E.164 format, or the identifier for the specified channel.');

export const ChannelEnum = z.enum([
  'WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM',
  'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT',
  'LINE', 'WECHAT'
]);

export const ConversationChannel = z.union([ChannelEnum, z.array(ChannelEnum).nonempty()])
  .describe('(Required) The channel to use for sending the message.')

export const ConversationAppIdOverride = z.string().optional()
  .describe('(Optional) The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable "CONVERSATION_APP_ID".')

export const MessageSenderNumberOverride = z.string().optional()
  .describe('(Optional) The phone number of the message\'s sender (E.164 format). If set, it will override the value from the environment variable "DEFAULT_SMS_ORIGINATOR".')

export const ConversationRegionOverride =  z.enum(['us', 'eu', 'br']).optional()
  .describe('(Optional) The region to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_REGION.')

export const TextMessage = z.string()
  .describe('(Required) The text to send.')
