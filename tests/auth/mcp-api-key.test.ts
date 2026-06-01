import type { Request, Response } from 'express';
import {
  createMcpApiKeyMiddleware,
  extractBearerToken,
  isValidMcpApiKey,
  loadMcpApiKeys,
} from '../../src/auth/mcp-api-key';

describe('mcp-api-key', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadMcpApiKeys', () => {
    it('loads MCP_API_KEY', () => {
      process.env.MCP_API_KEY = 'single-key';
      expect(loadMcpApiKeys()).toEqual(['single-key']);
    });

    it('loads and deduplicates MCP_API_KEYS', () => {
      process.env.MCP_API_KEYS = 'key-a, key-b, key-a';
      expect(loadMcpApiKeys()).toEqual(['key-a', 'key-b']);
    });
  });

  describe('extractBearerToken', () => {
    it('extracts token from Bearer header', () => {
      expect(extractBearerToken('Bearer my-token')).toBe('my-token');
    });

    it('returns undefined for missing or invalid header', () => {
      expect(extractBearerToken(undefined)).toBeUndefined();
      expect(extractBearerToken('Basic abc')).toBeUndefined();
      expect(extractBearerToken('Bearer ')).toBeUndefined();
    });
  });

  describe('isValidMcpApiKey', () => {
    it('accepts a matching configured key', () => {
      expect(isValidMcpApiKey('secret', ['secret', 'other'])).toBeTrue();
    });

    it('rejects missing or mismatched keys', () => {
      expect(isValidMcpApiKey(undefined, ['secret'])).toBeFalse();
      expect(isValidMcpApiKey('wrong', ['secret'])).toBeFalse();
      expect(isValidMcpApiKey('secret', [])).toBeFalse();
    });
  });

  describe('createMcpApiKeyMiddleware', () => {
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

    it('returns 503 when no keys are configured', () => {
      const middleware = createMcpApiKeyMiddleware([]);
      const req = { headers: { authorization: 'Bearer test' } } as Request;
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for invalid token', () => {
      const middleware = createMcpApiKeyMiddleware(['expected']);
      const req = { headers: { authorization: 'Bearer wrong' } } as Request;
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="sinch-mcp"');
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next for valid token', () => {
      const middleware = createMcpApiKeyMiddleware(['expected']);
      const req = { headers: { authorization: 'Bearer expected' } } as Request;
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
