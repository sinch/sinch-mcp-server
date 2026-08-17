import { extractHeaderValue, matchesAnyTag } from '../src/utils';

describe('extractHeaderValue', () => {
  test('returns the trimmed header value', () => {
    expect(extractHeaderValue('  order-123  ')).toBe('order-123');
  });

  test('takes the first value when the header is repeated', () => {
    expect(extractHeaderValue(['order-a', 'order-b'])).toBe('order-a');
  });

  test('returns undefined for a missing header', () => {
    expect(extractHeaderValue(undefined)).toBeUndefined();
  });

  test('returns undefined for an empty or whitespace-only header', () => {
    expect(extractHeaderValue('')).toBeUndefined();
    expect(extractHeaderValue('   ')).toBeUndefined();
  });
});

describe('hasMatchingTag', () => {
  test('should return true when there is a common tag', () => {
    const tags = ['apple 🍎', 'banana 🍌', 'orange 🍊'];
    const filteringTags = ['banana 🍌', 'grape 🍇'];
    expect(matchesAnyTag(tags, filteringTags)).toBeTruthy();
  });

  test('should return false when there are no common tags', () => {
    const tags = ['apple 🍎', 'banana 🍌', 'orange 🍊'];
    const filteringTags = ['grape 🍇', 'kiwi 🥝'];
    expect(matchesAnyTag(tags, filteringTags)).toBeFalsy();
  });

  test('should return false when tags array is empty (i.e. deactivated tool)', () => {
    const tags: string[] = [];
    const filteringTags = ['apple 🍎', 'banana 🍌'];
    expect(matchesAnyTag(tags, filteringTags)).toBeFalsy();
  });

  test('should return true when no filtering tag are provided (i.e. all tools are activated)', () => {
    const tags = ['apple 🍎', 'banana 🍌', 'orange 🍊'];
    const filteringTags: string[] = [];
    expect(matchesAnyTag(tags, filteringTags)).toBeTruthy();
  });

  test('should match even if casing if different', () => {
    const tags = ['banana 🍌'];
    const filteringTags = ['BANANA 🍌'];
    expect(matchesAnyTag(tags, filteringTags)).toBeTruthy();
  });

  test('should return true when multiple common tags exist', () => {
    const tags = ['apple 🍎', 'banana 🍌', 'orange 🍊'];
    const filteringTags = ['banana 🍌', 'orange 🍊', 'grape 🍇'];
    expect(matchesAnyTag(tags, filteringTags)).toBeTruthy();
  });
});
