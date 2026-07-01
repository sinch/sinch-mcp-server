import { formatRcsError } from '../../../../src/tools/rcs/utils/rcs-error-helper';
import { RcsApiError } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';
import { formatRcsSender, formatRcsSenderSummary } from '../../../../src/tools/rcs/utils/format-rcs-sender-response';
import { RcsSender } from '../../../../src/tools/rcs/types/rcs-api';

describe('formatRcsSender', () => {
  const sender = {
    id: 'sender-1',
    region: 'EU',
    billingCategory: 'NON_CONVERSATIONAL',
    useCase: 'PROMOTIONAL',
    state: 'DRAFT',
    authName: 'auth-name',
    authToken: 'secret-token',
    details: { brand: { name: 'Acme' } },
  } satisfies RcsSender;

  test('includes auth credentials for Conversation API bridge', () => {
    expect(formatRcsSender(sender)).toMatchObject({
      id: 'sender-1',
      authName: 'auth-name',
      authToken: 'secret-token',
    });
  });

  test('preserves testNumberStates so get-rcs-sender can surface all test numbers', () => {
    const withTestNumbers = {
      ...sender,
      testNumberStates: [{ number: '+14155552671', state: 'VERIFIED', submitted: '2026-06-19' }],
    } satisfies RcsSender;
    expect(formatRcsSender(withTestNumbers).testNumberStates).toEqual([
      { number: '+14155552671', state: 'VERIFIED', submitted: '2026-06-19' },
    ]);
  });

  test('summary omits credentials', () => {
    expect(formatRcsSenderSummary(sender)).toEqual({
      id: 'sender-1',
      state: 'DRAFT',
      region: 'EU',
      billingCategory: 'NON_CONVERSATIONAL',
      useCase: 'PROMOTIONAL',
    });
  });
});

describe('formatRcsError', () => {
  test('adds launch checklist hint for 412', () => {
    const error = new RcsApiError(412, 'Precondition Failed');
    expect(formatRcsError(error)).toBe(
      'HTTP 412: RCS API error (412 Precondition Failed) Launch checklist — use update-rcs-sender to fill any missing items: ' +
        'brand.name, brand.logoUrl (224×224 px), brand.bannerUrl (1440×448 px), brand.privacyPolicyUrl, ' +
        'brand.termsOfServiceUrl, at least one of brand.phones or brand.emails, at least one entry in countries, ' +
        'questionnaire.general.answers (all fields), questionnaire.verification.answers (all fields), and the ' +
        'country-specific questionnaire section for each country in countries.',
    );
  });

  test('adds RCS enablement hint for rbm_has_not_been_used', () => {
    const error = new RcsApiError(403, 'Forbidden', 'rbm_has_not_been_used');
    expect(formatRcsError(error)).toBe(
      'HTTP 403: RCS API error (403 Forbidden) errorCode=rbm_has_not_been_used ' +
        'RCS is not enabled on this project. Contact si-richmessaging@sinch.com.',
    );
  });

  test('suggests list/get on 409', () => {
    const error = new RcsApiError(409, 'Conflict');
    expect(formatRcsError(error)).toBe(
      'HTTP 409: RCS API error (409 Conflict) A sender may already exist. ' +
        'Use list-rcs-senders and get-rcs-sender instead of create.',
    );
  });
});
