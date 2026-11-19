import {
  AUTH_HOSTNAME,
  CONVERSATION_HOSTNAME,
  CONVERSATION_TEMPLATES_HOSTNAME,
  DEFAULT_VOICE_V2_HOSTNAME,
  NUMBER_LOOKUP_HOSTNAME,
  NUMBERS_HOSTNAME,
  PROVISIONING_HOSTNAME,
  VERIFICATION_HOSTNAME,
} from '@sinch/sdk-core';
import { env } from './env';

export const getSinchAuthUrl = (): string => env.SINCH_AUTH_URL ?? AUTH_HOSTNAME;

export const getSinchConversationUrl = (): string => env.SINCH_CONVERSATION_URL ?? CONVERSATION_HOSTNAME;

export const getSinchConversationTemplatesUrl = (): string =>
  env.SINCH_TEMPLATES_URL ?? CONVERSATION_TEMPLATES_HOSTNAME;

export const getSinchNumbersUrl = (): string => env.SINCH_NUMBERS_URL ?? NUMBERS_HOSTNAME;

export const getSinchVoiceUrl = (): string => env.SINCH_VOICE_URL ?? DEFAULT_VOICE_V2_HOSTNAME;

export const getSinchNumberLookupUrl = (): string => env.SINCH_NUMBER_LOOKUP_URL ?? NUMBER_LOOKUP_HOSTNAME;

export const getSinchVerificationUrl = (): string => env.SINCH_VERIFICATION_URL ?? VERIFICATION_HOSTNAME;

export const getSinchProvisioningUrl = (): string => env.SINCH_PROVISIONING_URL ?? PROVISIONING_HOSTNAME;
