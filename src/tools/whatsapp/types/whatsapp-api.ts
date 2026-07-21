import { z } from 'zod';
import {
  WhatsAppTemplateCategory as WhatsAppTemplateCategorySchema,
  WhatsAppTemplateLanguage as WhatsAppTemplateLanguageSchema,
} from '../prompt-schemas';

// Hand-written stand-ins for WhatsApp models @sinch/sdk-core doesn't expose
// yet. Remove once the SDK adds native template creation support.

// Derived from the Zod schema so accepted values can't drift from it.
export type WhatsAppTemplateLanguage = z.infer<typeof WhatsAppTemplateLanguageSchema>;
export type WhatsAppTemplateCategory = z.infer<typeof WhatsAppTemplateCategorySchema>;

export type WhatsAppTemplateStatus = 'DRAFT' | 'SUBMIT';

// ── request ──────────────────────────────────────────────────────────────

export interface WhatsAppMediaExample {
  url?: string;
  mimeType?: string;
}

export type WhatsAppHeaderComponentRequest =
  | { type: 'HEADER'; format: 'LOCATION' }
  | { type: 'HEADER'; format: 'TEXT'; text?: string; example?: string }
  | { type: 'HEADER'; format: 'DOCUMENT' | 'IMAGE' | 'VIDEO'; example?: WhatsAppMediaExample };

export interface WhatsAppBodyComponentRequest {
  type: 'BODY';
  text?: string;
  examples?: string[];
  addSecurityRecommendation?: boolean;
}

export interface WhatsAppFooterComponentRequest {
  type: 'FOOTER';
  text?: string;
  codeExpirationMinutes?: number;
}

export interface WhatsAppOtpSupportedApp {
  packageName: string;
  signatureHash: string;
}

export type WhatsAppButtonRequest =
  | { type: 'FLOW'; text?: string; flowId?: string; flowAction?: 'DATA_EXCHANGE' | 'NAVIGATE'; navigateScreen?: string }
  | {
      type: 'OTP';
      otpType: 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';
      text?: string;
      autofillText?: string;
      supportedApps?: WhatsAppOtpSupportedApp[];
      zeroTapTermsAccepted?: boolean;
      packageName?: string;
      signatureHash?: string;
    }
  | { type: 'PHONE_NUMBER'; text?: string; phoneNumber?: string }
  | { type: 'QUICK_REPLY'; text?: string }
  | { type: 'REQUEST_CONTACT_INFO' }
  | { type: 'URL'; text?: string; url?: string; example?: string };

export interface WhatsAppButtonsComponentRequest {
  type: 'BUTTONS';
  buttons?: WhatsAppButtonRequest[];
}

export type WhatsAppCardButtonRequest = Extract<
  WhatsAppButtonRequest,
  { type: 'URL' | 'QUICK_REPLY' | 'PHONE_NUMBER' }
>;

export type WhatsAppCardComponentRequest =
  | { type: 'HEADER'; format: 'IMAGE' | 'VIDEO'; example?: WhatsAppMediaExample }
  | { type: 'BODY'; text?: string; examples?: string[] }
  | { type: 'BUTTONS'; buttons?: WhatsAppCardButtonRequest[] };

export interface WhatsAppCardRequest {
  components?: WhatsAppCardComponentRequest[];
}

export interface WhatsAppCarouselComponentRequest {
  type: 'CAROUSEL';
  cards?: WhatsAppCardRequest[];
}

export type WhatsAppTemplateComponentRequest =
  | WhatsAppHeaderComponentRequest
  | WhatsAppBodyComponentRequest
  | WhatsAppFooterComponentRequest
  | WhatsAppButtonsComponentRequest
  | WhatsAppCarouselComponentRequest;

export interface WhatsAppTemplateDetailsRequest {
  components?: WhatsAppTemplateComponentRequest[];
  messageSendTtlSeconds?: number;
}

export interface CreateWhatsAppTemplateRequest {
  name: string;
  language: WhatsAppTemplateLanguage;
  category: WhatsAppTemplateCategory;
  details?: WhatsAppTemplateDetailsRequest;
  status?: WhatsAppTemplateStatus;
  saveDraftOnFailure?: boolean;
  allowCategoryChange?: boolean;
}

// ── response ─────────────────────────────────────────────────────────────
// Nested component/button variants stay Record<string, unknown>, matching
// how RcsSenderDetails.questionnaire/countryStatus/supplierDetails are typed.

export type WhatsAppTemplateState = 'APPROVED' | 'DISABLED' | 'PAUSED' | 'REJECTED' | string;

export type WhatsAppTemplateRejectionCode =
  | 'ABUSIVE_CONTENT'
  | 'INCORRECT_CATEGORY'
  | 'INVALID_FORMAT'
  | 'NONE'
  | 'SCAM'
  | string;

export type WhatsAppTemplateQualityScore =
  | 'QUALITY_SCORE_GREEN'
  | 'QUALITY_SCORE_RED'
  | 'QUALITY_SCORE_YELLOW'
  | 'QUALITY_SCORE_UNKNOWN'
  | string;

export interface WhatsAppTemplateButtonAnalytics {
  type: 'QUICK_REPLY' | 'UNIQUE_URL' | 'URL' | string;
  content: string;
  clicks: number;
}

export interface WhatsAppTemplateAnalytics {
  sent: number;
  delivered: number;
  read: number;
  start: string;
  end: string;
  buttons: WhatsAppTemplateButtonAnalytics[];
}

export interface WhatsAppTemplateDetailsResponse {
  components: Array<Record<string, unknown>>;
  messageSendTtlSeconds?: number;
}

export interface WhatsAppTemplateChanges {
  status: 'DRAFT' | 'IN_PROGRESS' | 'REJECTED';
  allowCategoryChange?: boolean;
  details?: WhatsAppTemplateDetailsResponse[];
}

export interface WhatsAppTemplateResponse {
  name: string;
  language: string;
  category: string;
  analytics: WhatsAppTemplateAnalytics[];
  isMetaGenerated: boolean;
  whatsappId?: string;
  state?: WhatsAppTemplateState;
  rejectionCode?: WhatsAppTemplateRejectionCode;
  qualityScore?: WhatsAppTemplateQualityScore;
  changes?: WhatsAppTemplateChanges;
  details?: WhatsAppTemplateDetailsResponse;
}

export interface WhatsAppApiErrorBody {
  errorCode?: string;
  message?: string;
  resolution?: string;
  additionalInformation?: Record<string, unknown>;
}
