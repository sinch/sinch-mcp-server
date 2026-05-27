import {
  appendRegionHint,
  buildUpdateMask,
  hasNoTriggers,
} from '../../../../src/tools/conversation/utils/webhook-tools-helper';

describe('appendRegionHint', () => {
  it('appends region guidance to error messages', () => {
    expect(appendRegionHint(new Error('Not found'), 'eu')).toBe(
      'Not found If the resource cannot be found, the region parameter may be incorrect. Current region: eu.',
    );
  });
});

describe('buildUpdateMask', () => {
  it('includes only fields present in the update body', () => {
    expect(buildUpdateMask({
      target: 'https://example.com/new',
      triggers: ['MESSAGE_DELIVERY'],
    })).toEqual(['target', 'triggers']);
  });
});

describe('hasNoTriggers', () => {
  it('returns true when triggers are missing or empty', () => {
    expect(hasNoTriggers(undefined)).toBe(true);
    expect(hasNoTriggers([])).toBe(true);
    expect(hasNoTriggers(['MESSAGE_INBOUND'])).toBe(false);
  });
});
