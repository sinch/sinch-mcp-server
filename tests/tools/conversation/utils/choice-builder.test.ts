import { buildChoices, choiceMessage } from '../../../../src/tools/conversation/utils/choice-builder';

describe('choiceMessage schema validation', () => {
  test('accepts location choice with lat: 0', () => {
    expect(choiceMessage.safeParse({ lat: 0, long: 32.5, title: 'On the equator' }).success).toBeTrue();
  });

  test('accepts location choice with long: 0', () => {
    expect(choiceMessage.safeParse({ lat: 51.4779, long: 0, title: 'Greenwich' }).success).toBeTrue();
  });

  test('accepts location choice with both lat and long at 0', () => {
    expect(choiceMessage.safeParse({ lat: 0, long: 0, title: 'Null Island' }).success).toBeTrue();
  });

  test('rejects when no choice type is provided', () => {
    expect(choiceMessage.safeParse({ title: 'No type' }).success).toBeFalse();
  });

  test('rejects a text choice carrying a title, which would be dropped', () => {
    const result = choiceMessage.safeParse({ text: 'Vanilla', title: 'Flavor' });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['title']);
  });

  test('rejects a location choice carrying both coordinates and an address', () => {
    const result = choiceMessage.safeParse({ lat: 0, long: 0, address: 'Null Island' });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['address']);
  });

  test('accepts a location choice with an address only', () => {
    expect(choiceMessage.safeParse({ address: 'Bilbao, Spain', title: 'Guggenheim' }).success).toBeTrue();
  });
});

describe('buildChoices', () => {
  test('an empty phone number does not hide the text choice', async () => {
    const choices = await buildChoices([{ phone_number: '', text: 'Vanilla' }]);

    expect(choices).toEqual([{ text_message: { text: 'Vanilla' } }]);
  });

  test('an empty text does not hide the URL choice', async () => {
    const choices = await buildChoices([{ text: '', url: 'https://example.com/vanilla' }]);

    expect(choices).toEqual([{ url_message: { url: 'https://example.com/vanilla', title: undefined } }]);
  });
});
