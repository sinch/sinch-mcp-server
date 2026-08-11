import { z } from 'zod';

export const WhatsAppTemplateLanguage = z.enum([
  'AF',
  'AR',
  'AZ',
  'BG',
  'BN',
  'CA',
  'CS',
  'DA',
  'DE',
  'EL',
  'EN',
  'EN_GB',
  'EN_US',
  'ES',
  'ES_AR',
  'ES_ES',
  'ES_MX',
  'ES_UY',
  'ET',
  'FA',
  'FI',
  'FIL',
  'FR',
  'GA',
  'GU',
  'HA',
  'HE',
  'HI',
  'HR',
  'HU',
  'ID',
  'IT',
  'JA',
  'KA',
  'KK',
  'KN',
  'KO',
  'KY_KG',
  'LO',
  'LT',
  'LV',
  'MK',
  'ML',
  'MR',
  'MS',
  'NB',
  'NL',
  'PA',
  'PL',
  'PT_BR',
  'PT_PT',
  'RO',
  'RU',
  'RW_RW',
  'SK',
  'SL',
  'SQ',
  'SR',
  'SV',
  'SW',
  'TA',
  'TE',
  'TH',
  'TR',
  'UK',
  'UR',
  'UZ',
  'VI',
  'ZH_CN',
  'ZH_HK',
  'ZH_TW',
  'ZU',
]);

export const WhatsAppTemplateCategory = z.enum(['AUTHENTICATION', 'MARKETING', 'UTILITY']);

export const WhatsAppTemplateStatus = z.enum(['DRAFT', 'SUBMIT']);

const WhatsAppMediaMimeType = z.enum(['IMAGE/JPEG', 'IMAGE/PNG', 'APPLICATION/PDF', 'VIDEO/3GP', 'VIDEO/MP4']);

const WhatsAppMediaExample = z.object({
  url: z
    .string()
    .optional()
    .describe(
      'Uploaded media file URL. Image: 8-bit RGB/RGBA JPEG or PNG, max 5MB. Video: H.264/AAC, single or no audio stream, 3GP or MP4, max 16MB. Document: PDF, max 100MB. Not required for draft.',
    ),
  mimeType: WhatsAppMediaMimeType.optional().describe(
    'Optional mime type of the file if it cannot be determined from the file contents.',
  ),
});

// ── header components ───────────────────────────────────────────────────────

const WhatsAppLocationHeader = z.object({
  type: z.literal('HEADER'),
  format: z.literal('LOCATION'),
});

const WhatsAppTextHeader = z.object({
  type: z.literal('HEADER'),
  format: z.literal('TEXT'),
  text: z
    .string()
    .optional()
    .describe('Text to show in the header. Can contain one header variable. Not required for draft.'),
  example: z
    .string()
    .optional()
    .describe('Example for the header variable. Required if there is a variable in the text header.'),
});

const WhatsAppMediaHeader = z.object({
  type: z.literal('HEADER'),
  format: z.enum(['DOCUMENT', 'IMAGE', 'VIDEO']),
  example: WhatsAppMediaExample.optional().describe('Header media example. Not required for draft.'),
});

const WhatsAppHeaderComponent = z
  .discriminatedUnion('format', [WhatsAppLocationHeader, WhatsAppTextHeader, WhatsAppMediaHeader])
  .describe('Template header. A LOCATION header takes no other fields; TEXT and media formats add their own.');

// ── body / footer components ───────────────────────────────────────────────

const WhatsAppBodyComponent = z.object({
  type: z.literal('BODY'),
  text: z.string().optional().describe('Body text. Not required for draft.'),
  examples: z
    .array(z.string())
    .optional()
    .describe(
      'Examples for the body variables. Requires one example for each variable in the body text. If no variables are used, the examples are optional.',
    ),
  addSecurityRecommendation: z
    .boolean()
    .optional()
    .describe(
      'Only valid if template category is AUTHENTICATION. Adds a security recommendation to the body. Defaults to false.',
    ),
});

const WhatsAppFooterComponent = z.object({
  type: z.literal('FOOTER'),
  text: z.string().optional(),
  codeExpirationMinutes: z
    .number()
    .optional()
    .describe(
      'Only valid if template category is AUTHENTICATION. If set, adds text detailing the code expiration time.',
    ),
});

// ── buttons ──────────────────────────────────────────────────────────────
// Shared shapes, reused unchanged by the carousel card buttons below.

const WhatsAppUrlButton = z.object({
  type: z.literal('URL'),
  text: z.string().optional().describe('Not required for draft.'),
  url: z
    .string()
    .optional()
    .describe(
      'The url address. To make it dynamic, add {{1}} at the end of the url (e.g. https://www.my-website.com?name={{1}}), not inside the domain. Restricted domains: wa.me, whatsapp.com. Not required for draft.',
    ),
  example: z
    .string()
    .optional()
    .describe(
      'Example of the full url with the dynamic value filled in. Required if the url contains {{1}}, e.g. https://www.my-website.com?name=john.',
    ),
});

const WhatsAppQuickReplyButton = z.object({
  type: z.literal('QUICK_REPLY'),
  text: z.string().optional().describe('Not required for draft.'),
});

const WhatsAppPhoneNumberButton = z.object({
  type: z.literal('PHONE_NUMBER'),
  text: z.string().optional().describe('Not required for draft.'),
  phoneNumber: z.string().optional().describe('Not required for draft.'),
});

const WhatsAppRequestContactInfoButton = z.object({
  type: z.literal('REQUEST_CONTACT_INFO'),
});

const WhatsAppFlowButton = z.object({
  type: z.literal('FLOW'),
  text: z.string().optional().describe('Text to display on the Flow button. Not required for draft.'),
  flowId: z.string().optional().describe('Flow ID to launch when the button is pressed. Not required for draft.'),
  flowAction: z.enum(['DATA_EXCHANGE', 'NAVIGATE']).optional().describe('Not required for draft.'),
  navigateScreen: z
    .string()
    .optional()
    .describe('The unique ID of the first screen. Required for the Navigate action.'),
});

const WhatsAppOtpSupportedApp = z.object({
  packageName: z.string().describe("Your Android app's package name."),
  signatureHash: z.string().describe('Your app signing key hash.'),
});

const WhatsAppOtpButton = z.object({
  type: z.literal('OTP'),
  otpType: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']),
  text: z.string().optional().describe('Not required for draft.'),
  autofillText: z.string().optional().describe('One-tap autofill button label text.'),
  supportedApps: z.array(WhatsAppOtpSupportedApp).optional().describe('List of supported apps for the OTP button.'),
  zeroTapTermsAccepted: z
    .boolean()
    .optional()
    .describe(
      'Set to true to indicate that zero-tap authentication use is subject to the WhatsApp Business Terms of Service, and that it is your responsibility to ensure customers expect the code to be auto-filled when they choose to receive it via WhatsApp.',
    ),
  packageName: z.string().optional().describe("Your Android app's package name."),
  signatureHash: z.string().optional().describe('Your app signing key hash.'),
});

const WhatsAppButton = z.discriminatedUnion('type', [
  WhatsAppFlowButton,
  WhatsAppOtpButton,
  WhatsAppPhoneNumberButton,
  WhatsAppQuickReplyButton,
  WhatsAppRequestContactInfoButton,
  WhatsAppUrlButton,
]);

const uniqueTypeAndText = (items: Array<{ type: string; text?: string }>) =>
  new Set(items.map((item) => `${item.type}:${item.text ?? ''}`)).size === items.length;

const WhatsAppButtonsComponent = z.object({
  type: z.literal('BUTTONS'),
  buttons: z
    .array(WhatsAppButton)
    .refine(uniqueTypeAndText, { message: 'Each button must have a unique type/text combination.' })
    .optional()
    .describe('Buttons. Not required for draft.'),
});

// ── carousel ─────────────────────────────────────────────────────────────

const WhatsAppCardHeader = z.object({
  type: z.literal('HEADER'),
  format: z.enum(['IMAGE', 'VIDEO']).describe('Card header format.'),
  example: WhatsAppMediaExample.optional().describe(
    'Uploaded media asset handle. Media assets are automatically cropped to a wide ratio based on the recipient device. Not required for draft.',
  ),
});

const WhatsAppCardBody = z.object({
  type: z.literal('BODY'),
  text: z.string().optional().describe('Card body text. Supports variables. Not required for draft.'),
  examples: z
    .array(z.string())
    .optional()
    .describe('Examples for the body variables. Requires one example for each variable in the body text.'),
});

const WhatsAppCardButton = z.discriminatedUnion('type', [
  WhatsAppUrlButton,
  WhatsAppQuickReplyButton,
  WhatsAppPhoneNumberButton,
]);

const WhatsAppCardButtonsComponent = z.object({
  type: z.literal('BUTTONS'),
  buttons: z
    .array(WhatsAppCardButton)
    .refine(uniqueTypeAndText, { message: 'Each card button must have a unique type/text combination.' })
    .optional()
    .describe('Card buttons. Can be a mix of quick reply, phone number, and URL buttons. Not required for draft.'),
});

const WhatsAppCardComponent = z.discriminatedUnion('type', [
  WhatsAppCardHeader,
  WhatsAppCardBody,
  WhatsAppCardButtonsComponent,
]);

const WhatsAppCard = z.object({
  components: z
    .array(WhatsAppCardComponent)
    .refine((components) => new Set(components.map((c) => c.type)).size === components.length, {
      message: 'Each card component type (HEADER, BODY, BUTTONS) may only appear once.',
    })
    .optional()
    .describe(
      'Components of the card: an image or video header asset, card body text, and up to two buttons. All cards in a template must have the same components. Not required for draft.',
    ),
});

const WhatsAppCarouselComponent = z.object({
  type: z.literal('CAROUSEL'),
  cards: z
    .array(WhatsAppCard)
    .optional()
    .describe(
      'Media cards. All cards defined on a template must have the same components. Only two cards need to be defined at creation — an approved template with two cards can send up to 10. Not required for draft.',
    ),
});

// ── details ──────────────────────────────────────────────────────────────

const WhatsAppTemplateComponent = z.union([
  WhatsAppHeaderComponent,
  WhatsAppBodyComponent,
  WhatsAppFooterComponent,
  WhatsAppButtonsComponent,
  WhatsAppCarouselComponent,
]);

export const WhatsAppTemplateDetails = z
  .object({
    components: z
      .array(WhatsAppTemplateComponent)
      .refine((components) => new Set(components.map((c) => c.type)).size === components.length, {
        message: 'Each component type (HEADER, BODY, FOOTER, BUTTONS, CAROUSEL) may only appear once.',
      })
      .refine((components) => components.some((c) => c.type === 'BODY'), {
        message: 'details.components must include a BODY component.',
      })
      .optional()
      .describe(
        'List of components in the template. Must contain a BODY component and can only have one entry of each type. Not required for draft.',
      ),
    messageSendTtlSeconds: z
      .number()
      .optional()
      .describe(
        'Template message delivery retry time-to-live override, in seconds. If unset, the message is retried for the ' +
          "category's default period before being dropped: AUTHENTICATION 600s (10 min), MARKETING 2592000s (30 days), " +
          'UTILITY 2592000s (30 days). If overriding, valid ranges differ from the defaults: AUTHENTICATION 10-900 ' +
          '(10 sec-15 min), MARKETING 43200-2592000 (12 hours-30 days), UTILITY 30-43200 (30 sec-12 hours). ' +
          'Authentication templates created before 2024-10-23 default to a 30-day TTL.',
      ),
  })
  .optional()
  .describe('Template input details and information. Not required for draft.');

// ── create-whatsapp-template ─────────────────────────────────────────────────
// POST /v1/projects/{projectId}/whatsapp/templates

export const CreateWhatsAppTemplateSchema = {
  name: z.string().describe('Template name.'),
  language: WhatsAppTemplateLanguage.describe('Template language.'),
  category: WhatsAppTemplateCategory.describe('Template category.'),
  details: WhatsAppTemplateDetails,
  status: WhatsAppTemplateStatus.optional().describe('Create as draft or submit for review. Defaults to submit.'),
  saveDraftOnFailure: z
    .boolean()
    .optional()
    .describe('Save the template as a draft if submission fails. Defaults to false.'),
  allowCategoryChange: z
    .boolean()
    .optional()
    .describe(
      'Allow Meta to change the category if they determine it is wrong; if false, Meta might reject the template instead. Defaults to false.',
    ),
};

// ── update-whatsapp-template ─────────────────────────────────────────────────
// PATCH /v1/projects/{projectId}/whatsapp/templates/{templateName}/languages/{languageCode}

export const UpdateWhatsAppTemplateSchema = {
  templateName: z.string().describe('The unique name of the template.'),
  languageCode: WhatsAppTemplateLanguage.describe('The language code of the specific template.'),
  status: WhatsAppTemplateStatus.optional().describe('Update as draft or submit for review. Defaults to draft.'),
  category: WhatsAppTemplateCategory.optional().describe(
    'New template category. Only applied if the template is a draft, or was rejected due to an incorrect category.',
  ),
  allowCategoryChange: z
    .boolean()
    .optional()
    .describe(
      'Allow Meta to change the category if they determine it is wrong; if false, Meta might reject the template instead. Only applied if the template is a draft, or was rejected due to an incorrect category. Defaults to false.',
    ),
  details: WhatsAppTemplateDetails,
};

// ── delete-single-whatsapp-template-language ─────────────────────────────────
// DELETE /v1/projects/{projectId}/whatsapp/templates/{templateName}/languages/{languageCode}
// Deletes a single language variant only — other languages of the same template name are unaffected.

export const DeleteSingleWhatsAppTemplateLanguageSchema = {
  templateName: z.string().describe('The unique name of the template.'),
  languageCode: z
    .string()
    .describe(
      'The language code of the specific template variant to delete (e.g. EN, ES_MX). Other language variants of this template name are left untouched.',
    ),
  deleteSubmitted: z
    .boolean()
    .optional()
    .describe(
      'Also delete the template already submitted to Meta, not just the draft. Defaults to false, which only deletes a draft and throws an error if the template has been submitted. Deleting an approved template does not free up its name — recreating a template with this same name and language is blocked for 30 days.',
    ),
};

// ── delete-all-whatsapp-template-languages ───────────────────────────────────
// DELETE /v1/projects/{projectId}/whatsapp/templates/{templateName}
// Deletes every language variant of the template name at once.

export const DeleteAllWhatsAppTemplateLanguagesSchema = {
  templateName: z
    .string()
    .describe(
      'The unique name of the template. Every language variant of this template name is deleted — to remove only one language, use delete-single-whatsapp-template-language instead.',
    ),
};
