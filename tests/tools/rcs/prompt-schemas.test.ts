import { RcsCreateSenderDetails, RcsSenderDetails } from '../../../src/tools/rcs/prompt-schemas';

const usQuestionnaire = { questionnaire: { us: { answers: { ownershipType: 'PRIVATE' } } } };

describe('RcsCreateSenderDetails', () => {
  test('rejects the US questionnaire section, which must go through update', () => {
    const result = RcsCreateSenderDetails.safeParse(usQuestionnaire);

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['us'] });
  });

  test('accepts the other questionnaire sections', () => {
    const details = {
      countries: ['GB'],
      questionnaire: { general: { answers: { optInDescription: 'Users opt in on the website.' } } },
    };

    expect(RcsCreateSenderDetails.parse(details)).toEqual(details);
  });
});

describe('RcsSenderDetails', () => {
  test('keeps the US questionnaire section on update', () => {
    expect(RcsSenderDetails.parse(usQuestionnaire)).toEqual(usQuestionnaire);
  });

  test('accepts AU and HR as launch countries', () => {
    expect(RcsSenderDetails.parse({ countries: ['AU', 'HR'] })).toEqual({ countries: ['AU', 'HR'] });
  });
});
