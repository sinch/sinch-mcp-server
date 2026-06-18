export type RcsRegion = 'BR' | 'EU' | 'US';

export type RcsBillingCategory =
  | 'CONVERSATIONAL'
  | 'NON_CONVERSATIONAL'
  | 'BASIC_MESSAGE'
  | 'CONVERSATIONAL_LEGACY'
  | 'SINGLE_MESSAGE';

export type RcsUseCase = 'MULTIUSE' | 'OTP' | 'PROMOTIONAL' | 'TRANSACTIONAL';

export type RcsSenderState = 'DRAFT' | 'IN_TEST' | 'PENDING_LAUNCH' | 'LAUNCHING' | 'LAUNCHED' | string;

export type RcsTestNumberState = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'DECLINED' | 'REJECTED' | 'INVALID' | string;

export interface RcsSenderBrand {
  name?: string;
  emails?: Array<{ label: string; address: string }>;
  phones?: Array<{ label: string; number: string }>;
  websites?: Array<{ label: string; url: string }>;
  color?: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  [key: string]: unknown;
}

export interface RcsSenderDetails {
  brand?: RcsSenderBrand;
  countries?: string[];
  questionnaire?: Record<string, unknown>;
  testNumbers?: string[];
  callbackUrl?: string;
  [key: string]: unknown;
}

export interface RcsSender {
  id: string;
  region: RcsRegion;
  billingCategory: RcsBillingCategory;
  useCase: RcsUseCase;
  state?: RcsSenderState;
  hostingRegion?: string;
  details?: RcsSenderDetails;
  authName?: string;
  authToken?: string;
  created?: string;
  modified?: string;
  launched?: string;
  conversationApiApp?: string;
  countryStatus?: Array<Record<string, unknown>>;
  supplierDetails?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateSenderRequest {
  region: RcsRegion;
  billingCategory: RcsBillingCategory;
  useCase: RcsUseCase;
  details?: RcsSenderDetails;
}

export type UpdateSenderRequest = Partial<Omit<CreateSenderRequest, 'region'>> & {
  details?: RcsSenderDetails;
};

export interface ListSendersResponse {
  senders?: RcsSender[];
  nextPageToken?: string;
}

export interface TestNumberStateResponse {
  testNumber: string;
  state: RcsTestNumberState;
  [key: string]: unknown;
}

export interface TestNumbersResponse {
  testNumbers?: TestNumberStateResponse[];
}

export interface CapabilitiesResponse {
  features?: string[];
  [key: string]: unknown;
}

export interface RcsApiErrorBody {
  errorCode?: string;
  message?: string;
  resolution?: string;
}
