import { getMissingLaunchRequirements } from '../../../../src/tools/rcs/utils/launch-requirements';
import { RcsSender } from '../../../../src/tools/rcs/types/rcs-api';

const completeSender = {
  id: 's1',
  region: 'EU',
  billingCategory: 'NON_CONVERSATIONAL',
  useCase: 'PROMOTIONAL',
  details: {
    brand: {
      name: 'Acme',
      logoUrl: 'https://example.com/logo.png',
      bannerUrl: 'https://example.com/banner.png',
      privacyPolicyUrl: 'https://example.com/privacy',
      termsOfServiceUrl: 'https://example.com/terms',
      phones: [{ label: 'Support', number: '+14155550000' }],
    },
    countries: ['GB'],
    questionnaire: {
      general: { answers: { optInDescription: 'opt-in text' } },
      verification: { answers: { name: 'John' } },
      gb: { answers: { brandIndustry: 'Technology' } },
    },
  },
} satisfies RcsSender;

test('returns empty array when all requirements are met', () => {
  expect(getMissingLaunchRequirements(completeSender)).toEqual([]);
});

test('flags missing brand fields', () => {
  const sender = {
    ...completeSender,
    details: {
      ...completeSender.details,
      brand: { name: 'Acme', phones: [{ label: 'Support', number: '+14155550000' }] },
    },
  } satisfies RcsSender;

  const missing = getMissingLaunchRequirements(sender);
  expect(missing).toEqual([
    'details.brand.logoUrl (JPEG/PNG, max 50 KB, 224×224 px)',
    'details.brand.bannerUrl (JPEG/PNG, max 200 KB, 1440×448 px)',
    'details.brand.privacyPolicyUrl',
    'details.brand.termsOfServiceUrl',
  ]);
});

test('flags missing contact when both phones and emails are absent', () => {
  const sender = {
    ...completeSender,
    details: {
      ...completeSender.details,
      brand: { ...completeSender.details.brand, phones: null, emails: null },
    },
  } satisfies RcsSender;

  expect(getMissingLaunchRequirements(sender)).toContain(
    'at least one of details.brand.phones or details.brand.emails',
  );
});

test('treats answers: {} as missing (empty object has no answers filled in)', () => {
  const sender = {
    ...completeSender,
    details: {
      ...completeSender.details,
      questionnaire: {
        general: { answers: {} },
        verification: { answers: {} },
        gb: { answers: {} },
      },
    },
  } satisfies RcsSender;

  const missing = getMissingLaunchRequirements(sender);
  expect(missing).toEqual([
    'details.questionnaire.general.answers',
    'details.questionnaire.verification.answers',
    'details.questionnaire.gb.answers (required for country GB)',
  ]);
});

test('flags missing country-specific section for US', () => {
  const sender = {
    ...completeSender,
    details: {
      ...completeSender.details,
      countries: ['US'],
      questionnaire: {
        general: { answers: { optInDescription: 'opt-in text' } },
        verification: { answers: { name: 'John' } },
      },
    },
  } satisfies RcsSender;

  expect(getMissingLaunchRequirements(sender)).toEqual(['details.questionnaire.us.answers (required for country US)']);
});

test('does not require a country-specific section for countries with no dedicated questionnaire', () => {
  const sender = {
    ...completeSender,
    details: {
      ...completeSender.details,
      countries: ['DE'],
      questionnaire: {
        general: { answers: { optInDescription: 'opt-in text' } },
        verification: { answers: { name: 'John' } },
      },
    },
  } satisfies RcsSender;

  expect(getMissingLaunchRequirements(sender)).toEqual([]);
});
