import { z } from 'zod';

export const RcsRegion = z.enum(['BR', 'EU', 'US']);

export const RcsBillingCategory = z.enum(['CONVERSATIONAL', 'NON_CONVERSATIONAL']);

export const RcsUseCase = z.enum(['MULTIUSE', 'OTP', 'PROMOTIONAL', 'TRANSACTIONAL']);

export const RcsSenderId = z.string().describe('RCS sender ID.');

export const RcsTestNumber = z.string().describe('Test phone number in E.164 format (e.g. +14155552671).');

// ── RCS sender details schema ─────────────────────────────────────────────────
// Maintainer note: this schema mirrors the PATCH
// /v1/projects/{projectId}/rcs/senders/{senderId} request body exactly. The API
// rejects any field it does not recognise, so when extending this schema only
// add fields that are documented in that request body.

// Allowed sector/industry values for the US questionnaire's brandIndustry field.
const RcsBrandIndustry = z.enum([
  'AGRICULTURE',
  'COMMUNICATION',
  'CONSTRUCTION',
  'EDUCATION',
  'ENERGY',
  'ENTERTAINMENT',
  'FINANCIAL',
  'GAMBLING',
  'GOVERNMENT',
  'HEALTHCARE',
  'HOSPITALITY',
  'HUMAN_RESOURCES',
  'INSURANCE',
  'LEGAL',
  'MANUFACTURING',
  'NON_GOVERNMENTAL_ORGANIZATION',
  'POLITICAL',
  'POSTAL',
  'PROFESSIONAL',
  'REAL_ESTATE',
  'RETAIL',
  'TECHNOLOGY',
  'TRANSPORTATION',
]);

const RcsBrandEmail = z.object({
  label: z.string().describe('Human-readable label for this email address.'),
  address: z.string().describe('Email address.'),
});

const RcsBrandPhone = z.object({
  label: z.string().describe('Human-readable label for this phone number.'),
  number: z.string().describe('Phone number without country code and separators, or a valid E.164 number.'),
});

const RcsBrandWebsite = z.object({
  label: z.string().describe('Human-readable label for this website.'),
  url: z.string().describe('Website URL.'),
});

const RcsBrand = z
  .object({
    name: z.string().optional().describe('Brand display name.'),
    emails: z
      .array(RcsBrandEmail)
      .nullable()
      .optional()
      .describe('Contact email list. Pass null to delete all existing values.'),
    phones: z
      .array(RcsBrandPhone)
      .nullable()
      .optional()
      .describe('Contact phone list. Pass null to delete all existing values.'),
    websites: z
      .array(RcsBrandWebsite)
      .nullable()
      .optional()
      .describe('Contact website list. Pass null to delete all existing values.'),
    color: z.string().optional().describe('Brand colour as a HEX code, e.g. "#FF5733".'),
    description: z.string().max(100).optional().describe('Short brand description. Max 100 characters.'),
    bannerUrl: z
      .string()
      .optional()
      .describe('Brand banner image URL. Must be JPEG or PNG, max 200 KB, exact 1440×448 px.'),
    logoUrl: z.string().optional().describe('Brand logo image URL. Must be JPEG or PNG, max 50 KB, exact 224×224 px.'),
    privacyPolicyUrl: z.string().optional().describe('URL to the brand Privacy Policy.'),
    termsOfServiceUrl: z.string().optional().describe('URL to the brand Terms & Conditions.'),
  })
  .describe('Brand information shown to end users.');

// The API also returns per-answer `metadata` objects (review state, reviewer
// comments, timestamps). They are deliberately omitted here: this schema is the
// PATCH *request* body, and metadata is read-only/server-managed — accepting it
// on input would have no effect. Review state is surfaced separately via
// get-rcs-sender.
const RcsQuestionnaireGeneralAnswers = z
  .object({
    optInDescription: z.string().nullable().optional().describe('How opt-in is obtained. Pass null to delete.'),
    triggerDescription: z
      .string()
      .nullable()
      .optional()
      .describe('Actions that trigger messages. Pass null to delete.'),
    interactionsDescription: z
      .string()
      .nullable()
      .optional()
      .describe('Description of user interactions. Pass null to delete.'),
    optOutDescription: z
      .string()
      .nullable()
      .optional()
      .describe('Message sent when a user opts out. Pass null to delete.'),
    videoUris: z.array(z.string()).nullable().optional().describe('Public video URIs for review. Pass null to delete.'),
    screenshotUris: z
      .array(z.string())
      .nullable()
      .optional()
      .describe('Public screenshot URIs for review. Pass null to delete.'),
  })
  .describe('Answers to the general launch questionnaire.');

const RcsQuestionnaireVerificationAnswers = z
  .object({
    name: z.string().nullable().optional().describe('Name of verification contact. Pass null to delete.'),
    email: z.string().nullable().optional().describe('Email of verification contact. Pass null to delete.'),
    title: z.string().nullable().optional().describe('Title of verification contact. Pass null to delete.'),
    website: z.string().nullable().optional().describe('Website of verification contact. Pass null to delete.'),
    phone: z
      .string()
      .nullable()
      .optional()
      .describe('Phone of verification contact in E.164 format. Required for US launch. Pass null to delete.'),
  })
  .describe('Answers to the verification questionnaire.');

const RcsQuestionnaireGbAnswers = z
  .object({
    brandIndustry: z.string().nullable().optional().describe('Sector or industry of business. Pass null to delete.'),
    companyLegalName: z
      .string()
      .nullable()
      .optional()
      .describe('Registered legal name of the company. Pass null to delete.'),
    companyRegistrationNumber: z.string().nullable().optional().describe('Company registration number.'),
    fullCompanyAddress: z.string().nullable().optional().describe('Full company address. Pass null to delete.'),
    messagesVolume: z.string().nullable().optional().describe('Estimated messages volume. Pass null to delete.'),
    messagesFrequency: z.string().nullable().optional().describe('Estimated messages frequency. Pass null to delete.'),
  })
  .describe('Answers to the UK-specific launch questionnaire.');

const RcsQuestionnaireFrAnswers = z
  .object({
    fullCompanyAddress: z.string().nullable().optional().describe('Full company address.'),
    siren: z.string().nullable().optional().describe('Company SIREN number (French business directory ID).'),
  })
  .describe('Answers to the France-specific launch questionnaire.');

const RcsUsState = z.enum([
  'AK',
  'AL',
  'AR',
  'AS',
  'AZ',
  'CA',
  'CO',
  'CT',
  'DC',
  'DE',
  'FL',
  'GA',
  'GU',
  'HI',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MP',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'PR',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VI',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
]);

// All fields are optional on create/update but required for launch.
const RcsQuestionnaireUsAnswers = z
  .object({
    ownershipType: z.enum(['PUBLIC', 'PRIVATE']).nullable().optional().describe('Ownership type of the company.'),
    legalForm: z
      .enum(['CORPORATION', 'LIMITED_LIABILITY_COMPANY', 'PARTNERSHIP', 'S_CORPORATION'])
      .nullable()
      .optional()
      .describe('Legal form of the company. PUBLIC ownership only allows CORPORATION.'),
    companyLegalName: z.string().nullable().optional().describe('Registered legal name of the company.'),
    companyPhoneNumber: z.string().nullable().optional().describe('Registered phone number of the company.'),
    companyEmailAddress: z.string().nullable().optional().describe('Email address of the company.'),
    brandName: z
      .string()
      .nullable()
      .optional()
      .describe('Brand name / Doing Business As (DBA). Must be legally associated with companyLegalName.'),
    brandIndustry: RcsBrandIndustry.nullable().optional().describe('Sector or industry of the business.'),
    taxIdCountry: z
      .string()
      .nullable()
      .optional()
      .describe('Country of tax registration (ISO 3166 two-letter code). Controls taxId and addressState validation.'),
    taxId: z
      .string()
      .nullable()
      .optional()
      .describe('Tax ID. For taxIdCountry US the format is XX-XXXXXXX; otherwise any string up to 25 characters.'),
    ein: z.string().nullable().optional().describe('US Employer Identification Number (format XX-XXXXXXX).'),
    stockExchange: z
      .string()
      .nullable()
      .optional()
      .describe('Primary stock exchange abbreviation. PUBLIC ownership only; not allowed for PRIVATE.'),
    stockSymbol: z
      .string()
      .nullable()
      .optional()
      .describe('Primary stock symbol. PUBLIC ownership only; not allowed for PRIVATE.'),
    addressLine: z.string().nullable().optional().describe('Street address line.'),
    addressCity: z.string().nullable().optional(),
    addressState: RcsUsState.nullable()
      .optional()
      .describe('US state abbreviation. Only when taxIdCountry is US; omit otherwise.'),
    addressCountry: z.string().nullable().optional().describe('ISO 3166 two-letter country code.'),
    addressPostalCode: z.string().nullable().optional(),
    fullCompanyAddress: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional().describe('Primary website URL.'),
    contactFirstName: z.string().nullable().optional().describe('First name of the responsible contact person.'),
    contactSurname: z.string().nullable().optional().describe('Surname of the responsible contact person.'),
    sampleMessages: z
      .array(z.string())
      .nullable()
      .optional()
      .describe('Sample messages for each use case or message type sent by the brand.'),
    messagesVolume: z.number().nullable().optional().describe('Estimated messages volume.'),
    embeddedLink: z.boolean().nullable().optional().describe('Whether URL links are embedded in messages.'),
    embeddedPhone: z.boolean().nullable().optional().describe('Whether phone numbers are embedded in messages.'),
    ageGatedContent: z.boolean().nullable().optional().describe('Whether the content is age-restricted.'),
    directLending: z.boolean().nullable().optional().describe('Whether the campaign involves direct lending.'),
    optInConfirmationMessage: z.string().nullable().optional().describe('Opt-in confirmation message sent to users.'),
    helpMessage: z.string().nullable().optional().describe('Help message of the campaign.'),
    callToActionMessage: z.string().nullable().optional().describe('Call to action message of the campaign.'),
    smsCampaign: z.string().nullable().optional().describe('US SMS campaign used as fallback.'),
  })
  .describe('Answers to the US-specific launch questionnaire.');

const RcsQuestionnaire = z
  .object({
    general: z
      .object({ answers: RcsQuestionnaireGeneralAnswers })
      .optional()
      .describe('General launch questions (required by all regions).'),
    verification: z
      .object({ answers: RcsQuestionnaireVerificationAnswers })
      .optional()
      .describe('Verification contact questions.'),
    gb: z.object({ answers: RcsQuestionnaireGbAnswers }).optional().describe('UK-specific launch questions.'),
    fr: z.object({ answers: RcsQuestionnaireFrAnswers }).optional().describe('France-specific launch questions.'),
    us: z.object({ answers: RcsQuestionnaireUsAnswers }).optional().describe('US-specific launch questions.'),
  })
  .describe("Launch questionnaire. Only provide the sections relevant to the sender's target countries.");

const RcsSenderCountry = z.enum([
  'AT',
  'BE',
  'BR',
  'CA',
  'CZ',
  'DK',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IT',
  'MX',
  'NL',
  'NO',
  'PE',
  'PL',
  'PT',
  'SG',
  'SK',
  'ES',
  'SE',
  'US',
  'GB',
]);

export const RcsSenderDetails = z
  .object({
    brand: RcsBrand.optional(),
    testNumbers: z
      .array(z.string())
      .max(200)
      .refine((items) => new Set(items).size === items.length, { message: 'Phone numbers must be unique.' })
      .nullable()
      .optional()
      .describe(
        'Phone numbers for testing. An agent can send 20 tester requests each day with a total maximum of 200 tester requests. Pass null to delete all.',
      ),
    countries: z
      .array(RcsSenderCountry)
      .nullable()
      .optional()
      .describe(
        'ISO 3166 two-letter country codes for the countries to launch this sender in. Pass null to delete all.',
      ),
    questionnaire: RcsQuestionnaire.optional(),
  })
  .optional()
  .describe(
    'Sender details. Accepted fields: brand, testNumbers, countries, questionnaire. Do not add any other top-level fields — they will be rejected by the API.',
  );

export const RcsPageToken = z
  .string()
  .optional()
  .describe('Pagination token from a previous list-rcs-senders response.');
