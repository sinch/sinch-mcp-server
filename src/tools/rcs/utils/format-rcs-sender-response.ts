import { RcsSender } from '../types/rcs-api';

// Full sender view (get/create/update/launch): an allow-list of the raw
// response. Fields not listed are dropped — internal bookkeeping, deprecated
// timestamps, and the legacy `conversationApiApp` (use
// `conversationApiAppDetails`). `testNumberStates` is kept so get-rcs-sender can
// surface every test number and its verification state.
export const formatRcsSender = (sender: RcsSender) => ({
  id: sender.id,
  state: sender.state,
  region: sender.region,
  billingCategory: sender.billingCategory,
  useCase: sender.useCase,
  hostingRegion: sender.hostingRegion,
  details: sender.details,
  countryStatus: sender.countryStatus,
  authName: sender.authName,
  authToken: sender.authToken,
  conversationApiAppDetails: sender.conversationApiAppDetails,
  testNumberStates: sender.testNumberStates,
  supplierDetails: sender.supplierDetails,
});

// Compact view for list-rcs-senders. Use formatRcsSender for single-sender
// operations that need brand details, credentials, test numbers or country status.
export const formatRcsSenderSummary = (sender: RcsSender) => ({
  id: sender.id,
  state: sender.state,
  region: sender.region,
  billingCategory: sender.billingCategory,
  useCase: sender.useCase,
});
