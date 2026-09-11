/* eslint-disable jest-extended/prefer-to-be-true, jest-extended/prefer-to-be-false */
import type { Request, Response } from 'express';
import { createAuthModeMiddleware, isMcpAuthMode, MCP_AUTH_MODES } from '../../src/auth/auth-mode';
import { AGENT_ID_HEADER } from '../../src/auth/credential-context';
import { SINCH_PROJECT_ID_CLAIM } from '../../src/auth/user-jwt';

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
};

const run = (mode: (typeof MCP_AUTH_MODES)[number], headers: Record<string, string>) => {
  const res = createMockResponse();
  const next = jest.fn();
  createAuthModeMiddleware(mode)({ headers } as unknown as Request, res, next);
  return { res, next };
};

const encodeSegment = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const jwt = (payload: Record<string, unknown>): string =>
  `${encodeSegment({ alg: 'RS256' })}.${encodeSegment(payload)}.sig`;

/** base64 of projectId:keyId:keySecret — the client-credentials blob. */
const CREDENTIALS_BLOB = Buffer.from('project-1:key-1:secret-1').toString('base64');
const SINCHID_TOKEN = `Bearer ${jwt({ [SINCH_PROJECT_ID_CLAIM]: 'project-1', sub: 'user-1' })}`;

describe('isMcpAuthMode', () => {
  it('accepts the configured modes', () => {
    expect(isMcpAuthMode('client-credentials')).toBe(true);
    expect(isMcpAuthMode('sinchid-agent')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isMcpAuthMode('sinchid_agent')).toBe(false);
    expect(isMcpAuthMode('')).toBe(false);
    expect(isMcpAuthMode(undefined)).toBe(false);
  });
});

describe('createAuthModeMiddleware', () => {
  describe('client-credentials', () => {
    it('passes a request whose Authorization decodes to a credential triple', () => {
      const { res, next } = run('client-credentials', { authorization: `Bearer ${CREDENTIALS_BLOB}` });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('rejects a request carrying x-agent-id with 401 and a challenge', () => {
      const { res, next } = run('client-credentials', {
        [AGENT_ID_HEADER]: 'order-42',
        authorization: `Bearer ${CREDENTIALS_BLOB}`,
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe(
        `Bearer realm="sinch-mcp", error="invalid_token", error_description="${AGENT_ID_HEADER} is not accepted by a client-credentials deployment; send Sinch API credentials in Authorization instead"`,
      );
    });

    it.each([
      ['a SinchID JWT', SINCHID_TOKEN],
      ['an opaque token', 'Bearer opaque-api-key'],
      ['a token that decodes without both separators', `Bearer ${Buffer.from('proj:key').toString('base64')}`],
    ])('rejects %s with 401', (_label, authorization) => {
      const { res, next } = run('client-credentials', { authorization });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'invalid_token',
        error_description: 'Authorization must carry Base64 projectId:keyId:keySecret as a Bearer token',
      });
    });

    it('rejects a request with no Authorization using a realm-only challenge', () => {
      const { res, next } = run('client-credentials', {});

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="sinch-mcp"');
      expect(res.body).toEqual({
        error: 'Unauthorized',
        error_description: 'Missing Sinch API credentials in the Authorization header',
      });
    });
  });

  describe('sinchid-agent', () => {
    it('passes a request carrying a SinchID token and x-agent-id', () => {
      const { res, next } = run('sinchid-agent', { authorization: SINCHID_TOKEN, [AGENT_ID_HEADER]: 'order-42' });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it.each([
      ['a Base64 credential triple', `Bearer ${CREDENTIALS_BLOB}`],
      ['an opaque token', 'Bearer opaque-api-key'],
    ])('rejects %s with 401', (_label, authorization) => {
      const { res, next } = run('sinchid-agent', { authorization });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe(
        'Bearer realm="sinch-mcp", error="invalid_token", error_description="Authorization must carry a SinchID access token as a Bearer JWT"',
      );
    });

    it('rejects a request with no Authorization using a realm-only challenge', () => {
      const { res, next } = run('sinchid-agent', { [AGENT_ID_HEADER]: 'order-42' });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="sinch-mcp"');
      expect(res.body).toEqual({
        error: 'Unauthorized',
        error_description: 'Missing SinchID access token in the Authorization header',
      });
    });
  });
});
