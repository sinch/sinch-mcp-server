import { formatRcsError, summarizeValidationErrors } from '../../../../src/tools/rcs/utils/rcs-error-helper';
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
      name: 'Acme',
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
        'brand.logoUrl (224×224 px), brand.bannerUrl (1440×448 px), brand.privacyPolicyUrl, ' +
        'brand.termsOfServiceUrl, at least one of brand.phones, brand.emails or brand.websites, at least one entry in countries, ' +
        'questionnaire.general.answers (optInDescription, triggerDescription, interactionsDescription, optOutDescription), ' +
        'questionnaire.verification.answers (name, email, website; phone for US) and the country-specific ' +
        'questionnaire section for each country in countries.',
    );
  });

  test('includes the API validationErrors when present', () => {
    const error = new RcsApiError(400, 'Bad Request', undefined, undefined, ['a must be a string', 'b is required']);
    expect(formatRcsError(error)).toBe(
      'HTTP 400: RCS API error (400 Bad Request) validationErrors: a must be a string; b is required.',
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

describe('summarizeValidationErrors', () => {
  const codes = (count: number) => Array.from({ length: count }, (_, i) => `C${i}`);

  test('shortens very long allowed-value lists', () => {
    const [shortened] = summarizeValidationErrors([
      `details.x.country must be one of the following values: ${codes(250).join(', ')}`,
    ]);

    expect(shortened).toBe(
      'details.x.country must be one of the following values: C0, C1, C2, C3, C4, C5, C6, C7, C8, C9, … ' +
        '(250 values in total, see the tool schema)',
    );
  });

  test('keeps short allowed-value lists and other messages untouched', () => {
    const errors = [
      `details.x.industry must be one of the following values: ${codes(23).join(', ')}`,
      'details.x.taxId must be a string',
    ];

    expect(summarizeValidationErrors(errors)).toEqual(errors);
  });
});
