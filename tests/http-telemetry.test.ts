import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { mcpRequestTelemetry } from '../src/http';
import { logger } from '../src/telemetry/logger';

const fakeRequest = (): Request => ({ method: 'POST' }) as Request;

const fakeResponse = (): Response => {
  const response = new EventEmitter() as EventEmitter & Partial<Response>;
  response.locals = {};
  response.statusCode = 200;
  Object.defineProperty(response, 'writableFinished', { value: false, writable: true, configurable: true });
  return response as Response;
};

describe('MCP request telemetry middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a premature close as aborted without the default response status', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const req = fakeRequest();
    const res = fakeResponse();
    const next = jest.fn() as NextFunction;

    mcpRequestTelemetry(req, res, next);
    (res as unknown as EventEmitter).emit('close');

    expect(next).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ status_code: expect.anything() }),
      'MCP request connection closed before response completed',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', route: '/mcp', outcome: 'aborted' }),
      expect.any(String),
    );
  });

  it('records a finished response once even when close follows finish', () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const req = fakeRequest();
    const res = fakeResponse();
    const next = jest.fn() as NextFunction;
    res.statusCode = 204;
    Object.defineProperty(res, 'writableFinished', { value: true });

    mcpRequestTelemetry(req, res, next);
    (res as unknown as EventEmitter).emit('finish');
    (res as unknown as EventEmitter).emit('close');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', route: '/mcp', outcome: 'completed', status_code: 204 }),
      'MCP request completed',
    );
  });
});
