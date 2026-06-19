import { RcsSender } from '../types/rcs-api';

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
  conversationApiApp: sender.conversationApiApp,
  conversationApiAppDetails: sender.conversationApiAppDetails,
  testNumberStates: sender.testNumberStates,
  created: sender.created,
  modified: sender.modified,
  launched: sender.launched,
  supplierDetails: sender.supplierDetails,
});

export const formatRcsSenderSummary = (sender: RcsSender) => ({
  id: sender.id,
  state: sender.state,
  region: sender.region,
  billingCategory: sender.billingCategory,
  useCase: sender.useCase,
  created: sender.created,
  modified: sender.modified,
  launched: sender.launched,
});
