import { RcsSender } from '../types/rcs-api';

// Country code → questionnaire section the launch checklist requires for it.
const COUNTRY_QUESTIONNAIRE_SECTION: Record<string, string> = {
  GB: 'gb',
  US: 'us',
  FR: 'fr',
};

// An answers object must exist AND have at least one key — `{}` is treated as
// empty because the API won't accept a questionnaire with no answers filled in.
const hasAnswers = (answers: unknown): boolean =>
  typeof answers === 'object' && answers !== null && Object.keys(answers).length > 0;

// Returns the launch requirements not yet met by the sender, in human-readable
// form, so the agent can fill them via update-rcs-sender before retrying.
export const getMissingLaunchRequirements = (sender: RcsSender): string[] => {
  const missing: string[] = [];
  const brand = sender.details?.brand;
  const countries = sender.details?.countries ?? [];
  const questionnaire = (sender.details?.questionnaire ?? {}) as Record<string, { answers?: unknown } | undefined>;

  if (!brand?.name) {
    missing.push('details.brand.name');
  }
  if (!brand?.logoUrl) {
    missing.push('details.brand.logoUrl (JPEG/PNG, max 50 KB, 224×224 px)');
  }
  if (!brand?.bannerUrl) {
    missing.push('details.brand.bannerUrl (JPEG/PNG, max 200 KB, 1440×448 px)');
  }
  if (!brand?.privacyPolicyUrl) {
    missing.push('details.brand.privacyPolicyUrl');
  }
  if (!brand?.termsOfServiceUrl) {
    missing.push('details.brand.termsOfServiceUrl');
  }
  if (!brand?.phones?.length && !brand?.emails?.length) {
    missing.push('at least one of details.brand.phones or details.brand.emails');
  }
  if (countries.length === 0) {
    missing.push('at least one entry in details.countries');
  }
  if (!hasAnswers(questionnaire.general?.answers)) {
    missing.push('details.questionnaire.general.answers');
  }
  if (!hasAnswers(questionnaire.verification?.answers)) {
    missing.push('details.questionnaire.verification.answers');
  }
  for (const code of countries) {
    const section = COUNTRY_QUESTIONNAIRE_SECTION[code];
    if (section && !hasAnswers(questionnaire[section]?.answers)) {
      missing.push(`details.questionnaire.${section}.answers (required for country ${code})`);
    }
  }

  return missing;
};
