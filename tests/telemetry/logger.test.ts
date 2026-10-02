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

  it('retains one sanitized level of wrapped network cause', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:443'), {
      code: 'ECONNREFUSED',
    });
    const error = new TypeError('fetch failed', { cause });

    expect(serializeError(error)).toEqual({
      type: 'TypeError',
      message: 'fetch failed',
      cause: {
        type: 'Error',
        message: 'connect ECONNREFUSED 10.0.0.1:443',
        code: 'ECONNREFUSED',
      },
    });
    expect(safeErrorFields(error)).toMatchObject({
      error_cause_type: 'Error',
      error_cause_code: 'ECONNREFUSED',
    });
  });

  it('reads only safe fields from an Axios-shaped error', () => {
    const error = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401, data: { secret: 'response-secret' } },
      config: { headers: { Authorization: 'Bearer request-token' } },
    });

    const serialized = serializeError(error);
    expect(serialized.status_code).toBe(401);
    expect(JSON.stringify(serialized)).not.toContain('response-secret');
    expect(JSON.stringify(serialized)).not.toContain('request-token');
  });

  it('redacts credentials embedded in URL userinfo', () => {
    const error = new Error('GET https://user:pass@api.example.test/v1/things?x=1 failed');

    expect(serializeError(error).message).toBe('GET https://[Redacted]@api.example.test/v1/things?[Redacted] failed');
  });
});
