import {
  appendRegionHint,
  buildDormantTriggersWarning,
  hasNoTriggers,
} from '../../../../src/tools/conversation/utils/webhook-tools-helper';

describe('appendRegionHint', () => {
  it('appends region guidance and other regions to error messages', () => {
    const hint = appendRegionHint(new Error('Not found'), 'eu');
    expect(hint).toBe(
      'Not found. If the resource cannot be found, the region parameter may be incorrect. Current region: eu. Other regions to try: us, br.',
    );
  });
});

describe('buildDormantTriggersWarning', () => {
  it('mentions update-webhook with the webhook id', () => {
    expect(buildDormantTriggersWarning('wh-1')).toContain('update-webhook');
    expect(buildDormantTriggersWarning('wh-1')).toContain('webhookId="wh-1"');
  });
});

describe('hasNoTriggers', () => {
  it('returns true when triggers are missing or empty', () => {
    expect(hasNoTriggers(undefined)).toBeTrue();
    expect(hasNoTriggers([])).toBeTrue();
    expect(hasNoTriggers(['MESSAGE_INBOUND'])).toBeFalse();
  });
});
