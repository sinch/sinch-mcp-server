import { safeErrorFields, serializeError } from '../../src/telemetry/logger';

describe('safe error logging', () => {
  it('retains useful error details without credentials or URL queries', () => {
    const error = Object.assign(
      new Error('request to https://api.example.test/messages?api_key=secret failed Authorization: Bearer token-value'),
      { code: 'ECONNRESET', status: 502 },
    );

    expect(serializeError(error)).toEqual({
      type: 'Error',
      message: 'request to https://api.example.test/messages?[Redacted] failed Authorization: Bearer [Redacted]',
      code: 'ECONNRESET',
      status_code: 502,
    });
    expect(JSON.stringify(safeErrorFields(error))).not.toContain('secret');
    expect(JSON.stringify(safeErrorFields(error))).not.toContain('token-value');
  });

  it('does not serialize arbitrary values from non-Error objects', () => {
    expect(serializeError({ password: 'secret' })).toEqual({ type: 'UnknownError' });
  });
});
