import { z } from 'zod';
import { RcsBillingCategory as RcsBillingCategorySchema } from '../prompt-schemas';

// NOTE: The types in this file are hand-written stand-ins for the RCS
// provisioning models that @sinch/sdk-core does not expose yet. Remove this file
// and import the models from the SDK once the dependency is bumped to a version
// with native RCS provisioning support.

export type RcsRegion = 'BR' | 'EU' | 'US';

// Derived from the Zod schema so the accepted billing categories stay in sync
// with the create-rcs-sender input schema (the only place this value is set).
export type RcsBillingCategory = z.infer<typeof RcsBillingCategorySchema>;

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
  conversationApiAppDetails?: ConversationApiAppDetails;
  testNumberStates?: TestNumberStateResponse[];
  countryStatus?: Array<Record<string, unknown>>;
  supplierDetails?: Record<string, unknown>;
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
}

export interface TestNumbersResponse {
  testNumbers?: TestNumberStateResponse[];
}

export interface CapabilitiesResponse {
  features?: string[];
}

export interface RcsApiErrorBody {
  errorCode?: string;
  message?: string;
  resolution?: string;
}
