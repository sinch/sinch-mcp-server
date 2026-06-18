import { RcsApiError } from './rcs-provisioning-client';

const LAUNCH_CHECKLIST_HINT =
  'Launch checklist: questionnaire complete, at least one country in details.countries, ' +
  'brand.phones or brand.emails set, brand.bannerUrl and logoUrl defined, ' +
  'privacyPolicyUrl and termsOfServiceUrl defined.';

const ERROR_HINTS: Record<string, string> = {
  rbm_has_not_been_used: 'RCS is not enabled on this project. Contact si-richmessaging@sinch.com.',
  rbm_too_many_requests: 'Test number invite limit reached (20/day, 200 total). Wait 24h and retry.',
};

export const formatRcsError = (error: unknown): string => {
  if (error instanceof RcsApiError) {
    const parts = [`HTTP ${error.status}: ${error.message}`];
    if (error.errorCode) {
      parts.push(`errorCode=${error.errorCode}`);
      const hint = ERROR_HINTS[error.errorCode];
      if (hint) {
        parts.push(hint);
      }
    }
    if (error.resolution) {
      parts.push(error.resolution);
    }
    if (error.status === 409) {
      parts.push('A sender may already exist. Use list-rcs-senders and get-rcs-sender instead of create.');
    }
    if (error.status === 412) {
      parts.push(LAUNCH_CHECKLIST_HINT);
    }
    return parts.join(' ');
  }

  return error instanceof Error ? error.message : String(error);
};
