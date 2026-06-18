import { z } from 'zod';

export const RcsRegion = z.enum(['BR', 'EU', 'US']);

export const RcsBillingCategory = z.enum([
  'CONVERSATIONAL',
  'NON_CONVERSATIONAL',
  'BASIC_MESSAGE',
  'CONVERSATIONAL_LEGACY',
  'SINGLE_MESSAGE',
]);

export const RcsUseCase = z.enum(['MULTIUSE', 'OTP', 'PROMOTIONAL', 'TRANSACTIONAL']);

export const RcsSenderId = z.string().describe('RCS sender ID.');

export const RcsTestNumber = z.string().describe('Test phone number in E.164 format (e.g. +14155552671).');

export const RcsSenderDetails = z
  .record(z.unknown())
  .optional()
  .describe(
    'Full sender details object: brand, questionnaire, countries, etc. Can be sent on create or update in one call.',
  );

export const RcsPageToken = z
  .string()
  .optional()
  .describe('Pagination token from a previous list-rcs-senders response.');
