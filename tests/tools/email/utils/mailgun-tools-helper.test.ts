import { sha256 } from '../../../../src/tools/email/utils/mailgun-tools-helper';

describe('hashing function', () => {

  it('should return a valid hash for a given input', () => {
    const input = 'test input';
    const expectedHash = '9dfe6f15d1ab73af898739394fd22fd72a03db01834582f24bb2e1c66c7aaeae';
    expect(sha256(input)).toBe(expectedHash);
  });

  it('should return different hashes for different inputs', () => {
    const input1 = 'input one';
    const input2 = 'input two';
    expect(sha256(input1)).not.toBe(sha256(input2));
  });

  it('should return the same hash for the same input', () => {
    const input = 'consistent input';
    expect(sha256(input)).toBe(sha256(input));
  });

  it('should handle empty strings', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
