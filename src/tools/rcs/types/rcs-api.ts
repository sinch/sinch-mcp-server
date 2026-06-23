export type RcsRegion = 'BR' | 'EU' | 'US';

export type RcsBillingCategory =
  | 'CONVERSATIONAL'
  | 'NON_CONVERSATIONAL'
  | 'BASIC_MESSAGE'
  | 'CONVERSATIONAL_LEGACY'
  | 'SINGLE_MESSAGE';

export type RcsUseCase = 'MULTIUSE' | 'OTP' | 'PROMOTIONAL' | 'TRANSACTIONAL';

export type RcsSenderState =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'IN_TEST'
  | 'PREPARING_LAUNCH'
  | 'LAUNCHING'
  | 'LAUNCHED'
  | 'UNLAUNCHED'
  | 'UNKNOWN'
  | string;

export type RcsTestNumberState = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'DECLINED' | 'REJECTED' | 'INVALID' | string;

export interface RcsSenderBrand {
  name?: string;
  emails?: Array<{ label: string; address: string }> | null;
  phones?: Array<{ label: string; number: string }> | null;
  websites?: Array<{ label: string; url: string }> | null;
  color?: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

export interface RcsSenderDetails {
  brand?: RcsSenderBrand;
  countries?: string[] | null;
  questionnaire?: Record<string, unknown>;
  testNumbers?: string[] | null;
}

export interface ConversationApiAppDetails {
  id: string;
  projectId: string;
  region: string;
  channelStatus?: string;
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
  conversationApiAppDetails?: ConversationApiAppDetails;
  testNumberStates?: TestNumberStateResponse[];
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

// The update (PATCH) endpoint only accepts a `details` body; billingCategory,
// useCase and region are set at creation and cannot be changed via update.
export interface UpdateSenderRequest {
  details: RcsSenderDetails;
}

export interface ListSendersResponse {
  senders?: RcsSender[];
  totalSize?: number;
  pageSize?: number;
  previousPageToken?: string;
  nextPageToken?: string;
}

export interface TestNumberStateResponse {
  number: string;
  state: RcsTestNumberState;
  submitted?: string;
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
