import { formatRcsError } from '../../../../src/tools/rcs/utils/rcs-error-helper';
import { RcsApiError } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';
import { formatRcsSender, formatRcsSenderSummary } from '../../../../src/tools/rcs/utils/format-rcs-sender-response';

describe('formatRcsSender', () => {
  const sender = {
    id: 'sender-1',
    region: 'EU' as const,
    billingCategory: 'NON_CONVERSATIONAL' as const,
    useCase: 'PROMOTIONAL' as const,
    state: 'DRAFT',
    authName: 'auth-name',
    authToken: 'secret-token',
    details: { brand: { name: 'Acme' } },
  };

  test('includes auth credentials for Conversation API bridge', () => {
    expect(formatRcsSender(sender)).toMatchObject({
      id: 'sender-1',
      authName: 'auth-name',
      authToken: 'secret-token',
    });
  });

  test('summary omits credentials', () => {
    expect(formatRcsSenderSummary(sender)).toEqual({
      id: 'sender-1',
      state: 'DRAFT',
      region: 'EU',
      billingCategory: 'NON_CONVERSATIONAL',
      useCase: 'PROMOTIONAL',
      created: undefined,
      modified: undefined,
      launched: undefined,
    });
  });
});

describe('formatRcsError', () => {
  test('adds launch checklist hint for 412', () => {
    const error = new RcsApiError(412, 'Precondition Failed');
    expect(formatRcsError(error)).toContain('Launch checklist');
  });

  test('adds RCS enablement hint for rbm_has_not_been_used', () => {
    const error = new RcsApiError(403, 'Forbidden', 'rbm_has_not_been_used');
    expect(formatRcsError(error)).toContain('si-richmessaging@sinch.com');
  });

  test('suggests list/get on 409', () => {
    const error = new RcsApiError(409, 'Conflict');
    expect(formatRcsError(error)).toContain('list-rcs-senders');
  });
});
