import type { NextFunction, Request, Response } from 'express';
import { buildJsonRpcErrorResponse } from '../json-rpc';
import { parseSinchCredentialsHeader, SINCH_CREDENTIALS_HEADER } from './sinch-oauth-credentials';

export const createSinchCredentialsMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const credentials = parseSinchCredentialsHeader(req.headers[SINCH_CREDENTIALS_HEADER]);
    if (!credentials) {
      res
        .status(401)
        .json(
          buildJsonRpcErrorResponse(
            -32001,
            `Unauthorized: missing or invalid ${SINCH_CREDENTIALS_HEADER} header (Base64 of projectId:keyId:keySecret).`,
            req.body,
          ),
        );
      return;
    }

    next();
  };
};
