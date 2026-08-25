import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { getRequestAgentId, getRequestUserClaims, runWithHttpCredentialHeaders } from './auth/credential-context';
import { setHttpCredentialSource } from './auth/http-credential-mode';
import { createMcpApiKeyMiddleware, loadMcpApiKeys } from './auth/mcp-api-key';
import { env } from './env';
import { buildJsonRpcErrorResponse } from './json-rpc';
import { getToolsFilter, instantiateMcpServer, registerCapabilities } from './server';
import {
  createSession,
  deleteSession,
  pingSessionStore,
  SessionStoreUnavailableError,
  validateAndTouchSession,
} from './session-store';
import { logger } from './telemetry/logger';

dotenv.config();

const MCP_PATH = '/mcp';
const HEALTH_LIVE_PATH = '/health/live';
const HEALTH_READY_PATH = '/health/ready';
const DEFAULT_PORT = 8000;
const SESSION_STORE_UNAVAILABLE_CODE = -32003;

const startedAtMs = Date.now();
let isShuttingDown = false;

/** Exposed for unit tests. */
export const setShuttingDownForTests = (value: boolean): void => {
  isShuttingDown = value;
};

const isInitializationBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false;
  }

  if (Array.isArray(body)) {
    return body.some((message) => isInitializeRequest(message));
  }

  return isInitializeRequest(body);
};

const getSessionId = (req: Request): string | undefined => {
  const header = req.headers['mcp-session-id'];
  if (typeof header === 'string') {
    return header;
  }
  return undefined;
};

const buildTransport = async (): Promise<StreamableHTTPServerTransport> => {
  const mcpServer = instantiateMcpServer();
  registerCapabilities(mcpServer, getToolsFilter(process.argv));

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);

  return transport;
};

const logUserJwtAuditTrail = (): void => {
  const claims = getRequestUserClaims();
  if (!claims) {
    return;
  }

  logger.info(
    {
      project_id: claims.projectId,
      account_id: claims.accountId,
      global_user_id: claims.globalUserId,
      scope: claims.scope,
      agent_id: getRequestAgentId(),
    },
    'Agent user request (unverified JWT claims)',
  );
};

const respondSessionStoreUnavailable = (res: Response, body: unknown): void => {
  res
    .setHeader('Retry-After', '2')
    .status(503)
    .json(
      buildJsonRpcErrorResponse(SESSION_STORE_UNAVAILABLE_CODE, 'Service Unavailable: session store unreachable', body),
    );
};

export const createHttpApp = () => {
  const mcpApiKeys = loadMcpApiKeys();
  const isSingleTenant = mcpApiKeys.length > 0;

  if (isSingleTenant) {
    setHttpCredentialSource('env');
  } else {
    // Multi-tenant: each deployment is pinned to one Conversation API region. Defaulting to a
    // region silently could route traffic to the wrong region, so refuse to start instead.
    if (!env.CONVERSATION_REGION) {
      throw new Error(
        'The server is starting in multi-tenant mode because neither MCP_API_KEY nor MCP_API_KEYS is set. ' +
          'In multi-tenant mode, the CONVERSATION_REGION environment variable is required: ' +
          'refusing to start rather than defaulting to a region. ' +
          'Either set CONVERSATION_REGION, or set MCP_API_KEY to run in single-tenant mode.',
      );
    }
    setHttpCredentialSource('request-header');
  }

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionId = getSessionId(req);
    const isInitRequest = isInitializationBody(req.body);

    if (isInitRequest) {
      if (sessionId) {
        res
          .status(400)
          .json(buildJsonRpcErrorResponse(-32600, 'Invalid Request: server already initialized', req.body));
        return;
      }

      const newSessionId = randomUUID();
      try {
        await createSession(newSessionId);
      } catch (error) {
        if (error instanceof SessionStoreUnavailableError) {
          respondSessionStoreUnavailable(res, req.body);
          return;
        }
        throw error;
      }

      res.setHeader('mcp-session-id', newSessionId);
      const transport = await buildTransport();
      res.on('close', () => void transport.close());
      await runWithHttpCredentialHeaders(req.headers, () => {
        logUserJwtAuditTrail();
        return transport.handleRequest(req, res, req.body);
      });
      return;
    }

    if (!sessionId) {
      res.status(400).json(buildJsonRpcErrorResponse(-32000, 'Bad Request: No valid session ID provided', req.body));
      return;
    }

    let sessionValid: boolean;
    try {
      sessionValid = await validateAndTouchSession(sessionId);
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        respondSessionStoreUnavailable(res, req.body);
        return;
      }
      throw error;
    }

    if (!sessionValid) {
      res.status(404).json(buildJsonRpcErrorResponse(-32001, 'Session not found', req.body));
      return;
    }

    if (req.method === 'DELETE') {
      try {
        await deleteSession(sessionId);
      } catch (error) {
        if (error instanceof SessionStoreUnavailableError) {
          respondSessionStoreUnavailable(res, req.body);
          return;
        }
        throw error;
      }
      res.status(200).end();
      return;
    }

    const transport = await buildTransport();
    res.on('close', () => void transport.close());
    await runWithHttpCredentialHeaders(req.headers, () => {
      logUserJwtAuditTrail();
      return transport.handleRequest(req, res, req.body);
    });
  };

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Unauthenticated probes for Kubernetes (must stay outside MCP auth middleware).
  app.get(HEALTH_LIVE_PATH, (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
    });
  });

  app.get(HEALTH_READY_PATH, (_req, res) => {
    void (async () => {
      if (isShuttingDown) {
        res.status(503).json({ status: 'not_ready', reason: 'shutting_down' });
        return;
      }

      if (!(await pingSessionStore())) {
        res.status(503).json({ status: 'not_ready', reason: 'session_store_unreachable' });
        return;
      }

      res.status(200).json({ status: 'ready' });
    })();
  });

  if (isSingleTenant) {
    app.use(MCP_PATH, createMcpApiKeyMiddleware(mcpApiKeys));
  }

  const routeHandler = (req: Request, res: Response) => {
    void handleMcpRequest(req, res).catch((error) => {
      console.error(`Error handling MCP ${req.method} request:`, error);
      if (!res.headersSent) {
        res.status(500).json(buildJsonRpcErrorResponse(-32603, 'Internal server error', req.body));
      }
    });
  };

  app.post(MCP_PATH, routeHandler);
  app.delete(MCP_PATH, routeHandler);

  // GET/SSE unsupported: per-request transports can't receive a later push, so the stream is dead weight.
  app.get(MCP_PATH, (_req, res) => {
    res.setHeader('Allow', 'POST, DELETE');
    res
      .status(405)
      .json(
        buildJsonRpcErrorResponse(
          -32000,
          'Method Not Allowed: server-initiated notifications are not supported; use POST for all MCP requests',
          null,
        ),
      );
  });

  return app;
};

/** Exposed for unit tests. */
export const getShutdownDrainMs = (): number => {
  const configured = Number(process.env.SHUTDOWN_DRAIN_MS ?? 10_000);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 10_000;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Logs only host:port — never the password. */
const describeRedisTarget = (): string => `${env.REDIS_HOST}:${env.REDIS_PORT}`;

/** Exposed for unit tests. */
export const waitForListening = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.once('listening', resolve);
    server.once('error', reject);
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

// Fail readiness first so the Service stops routing, then drain before close.
// Pairs with the Deployment preStop sleep for endpoint controller lag.
const shutdown = async (server: Server, signal: string): Promise<void> => {
  // Guards against a second signal (e.g. SIGTERM then SIGINT) re-running the drain
  // and closing an already-closed server.
  if (isShuttingDown) {
    return;
  }
  console.error(`Received ${signal}, marking not ready before closing HTTP server`);
  isShuttingDown = true;
  const drainMs = getShutdownDrainMs();
  if (drainMs > 0) {
    console.error(`Draining for ${drainMs}ms before closing listeners`);
    await sleep(drainMs);
  }
  try {
    await closeServer(server);
    process.exit(0);
  } catch (error) {
    console.error('Error during HTTP server shutdown:', error);
    process.exit(1);
  }
};

export const main = async (): Promise<void> => {
  const missingRedisVars = (['REDIS_HOST', 'REDIS_PORT'] as const).filter((key) => !env[key]);
  if (missingRedisVars.length > 0) {
    console.error(
      `Fatal: ${missingRedisVars.join(', ')} not set. The HTTP server requires Redis for shared session storage.`,
    );
    process.exit(1);
    return;
  }

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const app = createHttpApp();
  const server = app.listen(port);

  process.on('SIGTERM', () => void shutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => void shutdown(server, 'SIGINT'));

  await waitForListening(server);

  console.error(
    `Sinch MCP HTTP server listening on port ${port} (${MCP_PATH}), session store: ${describeRedisTarget()}`,
  );
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in HTTP main():', error);
    process.exit(1);
  });
}
