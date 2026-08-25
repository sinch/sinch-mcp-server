import type { Request, Response } from 'express';
import { createSinchCredentialsMiddleware } from '../../src/auth/sinch-credentials-middleware';
import { SINCH_CREDENTIALS_HEADER } from '../../src/auth/sinch-oauth-credentials';

describe('createSinchCredentialsMiddleware', () => {
  const buildResponse = (): Response => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  it('calls next() when a valid X-Sinch-Credentials header is present', () => {
    const middleware = createSinchCredentialsMiddleware();
    const req = {
      headers: { [SINCH_CREDENTIALS_HEADER]: Buffer.from('proj:key:secret').toString('base64') },
    } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 and does not call next() when the header is missing', () => {
    const middleware = createSinchCredentialsMiddleware();
    const req = { headers: {} } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    const jsonMock = res.json as jest.Mock;
    const body = jsonMock.mock.calls[0][0];
    expect(body.error.message).toContain(SINCH_CREDENTIALS_HEADER);
  });

  it('returns 401 and does not call next() when the header is malformed', () => {
    const middleware = createSinchCredentialsMiddleware();
    const req = { headers: { [SINCH_CREDENTIALS_HEADER]: 'not-valid-base64-creds' } } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
