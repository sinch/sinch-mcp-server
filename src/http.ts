import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { getRequestAgentId, getRequestUserClaims, runWithHttpCredentialHeaders } from './auth/credential-context';
import { setHttpCredentialSource } from './auth/http-credential-mode';
import { createMcpApiKeyMiddleware, loadMcpApiKeys } from './auth/mcp-api-key';
import { getMaxMcpSessions, isMcpSessionCapacityReached } from './auth/http-session-limits';
import { env } from './env';
import { buildJsonRpcErrorResponse } from './json-rpc';
import { instantiateMcpServer, getToolsFilter, registerCapabilities } from './server';
import { logger } from './telemetry/logger';

dotenv.config();

const MCP_PATH = '/mcp';
const HEALTH_LIVE_PATH = '/health/live';
const HEALTH_READY_PATH = '/health/ready';
const HEALTH_LIVE_PATHS = [HEALTH_LIVE_PATH, `${MCP_PATH}${HEALTH_LIVE_PATH}`];
const HEALTH_READY_PATHS = [HEALTH_READY_PATH, `${MCP_PATH}${HEALTH_READY_PATH}`];
const DEFAULT_PORT = 8000;

const startedAtMs = Date.now();
let isShuttingDown = false;

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, SessionEntry>();

/** Exposed for unit tests. */
export const setShuttingDownForTests = (value: boolean): void => {
  isShuttingDown = value;
};

/** Exposed for unit tests — inserts a placeholder session entry. */
export const seedSessionForTests = (sessionId = 'test-session'): void => {
  sessions.set(sessionId, {
    transport: {} as StreamableHTTPServerTransport,
  });
};

/** Exposed for unit tests. */
export const clearSessionsForTests = (): void => {
  sessions.clear();
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

const removeSession = async (sessionId: string): Promise<void> => {
  const entry = sessions.get(sessionId);
  if (!entry) {
    return;
  }

  sessions.delete(sessionId);
  try {
    await entry.transport.close();
  } catch (error) {
    console.error(`Error closing transport for session ${sessionId}:`, error);
  }
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

const createSession = async (): Promise<SessionEntry> => {
  const mcpServer = instantiateMcpServer();
  registerCapabilities(mcpServer, getToolsFilter(process.argv));

  let sessionId = '';

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessionId = id;
      sessions.set(id, { transport });
    },
    onsessionclosed: async (id) => {
      await removeSession(id);
    },
  });

  transport.onclose = async () => {
    if (sessionId) {
      await removeSession(sessionId);
    }
  };

  await mcpServer.connect(transport);

  return { transport };
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

    if (sessionId) {
      const entry = sessions.get(sessionId);
      if (!entry) {
        res.status(404).json(buildJsonRpcErrorResponse(-32001, 'Session not found', req.body));
        return;
      }

      await runWithHttpCredentialHeaders(req.headers, () => {
        logUserJwtAuditTrail();
        return entry.transport.handleRequest(req, res, req.body);
      });
      return;
    }

    if (!isInitializationBody(req.body)) {
      res.status(400).json(buildJsonRpcErrorResponse(-32000, 'Bad Request: No valid session ID provided', req.body));
      return;
    }

    if (isMcpSessionCapacityReached(sessions.size)) {
      res
        .status(503)
        .json(
          buildJsonRpcErrorResponse(-32000, 'Service Unavailable: maximum number of MCP sessions reached', req.body),
        );
      return;
    }

    const entry = await createSession();
    await runWithHttpCredentialHeaders(req.headers, () => {
      logUserJwtAuditTrail();
      return entry.transport.handleRequest(req, res, req.body);
    });
  };

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Unauthenticated probes for Kubernetes (must stay outside MCP auth middleware).
  app.get(HEALTH_LIVE_PATHS, (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
    });
  });

  app.get(HEALTH_READY_PATHS, (_req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: 'not_ready', reason: 'shutting_down' });
      return;
    }

    if (isMcpSessionCapacityReached(sessions.size)) {
      res.status(503).json({
        status: 'not_ready',
        reason: 'session_capacity_reached',
        activeSessions: sessions.size,
        maxSessions: getMaxMcpSessions(),
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      activeSessions: sessions.size,
      maxSessions: getMaxMcpSessions(),
    });
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
  app.get(MCP_PATH, routeHandler);
  app.delete(MCP_PATH, routeHandler);

  return app;
};

/** Exposed for unit tests. */
export const getShutdownDrainMs = (): number => {
  const configured = Number(process.env.SHUTDOWN_DRAIN_MS ?? 10_000);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 10_000;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

// server.close() only stops accepting new connections; open SSE streams from active
// MCP sessions keep sockets alive and would block close() indefinitely, so drop them first.
const closeAllSessions = (): Promise<void[]> => Promise.all(Array.from(sessions.keys()).map(removeSession));

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
    await closeAllSessions();
    await closeServer(server);
    process.exit(0);
  } catch (error) {
    console.error('Error during HTTP server shutdown:', error);
    process.exit(1);
  }
};

export const main = async (): Promise<void> => {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const app = createHttpApp();
  const server = app.listen(port);

  process.on('SIGTERM', () => void shutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => void shutdown(server, 'SIGINT'));

  await waitForListening(server);

  console.error(`Sinch MCP HTTP server listening on port ${port} (${MCP_PATH}, max sessions: ${getMaxMcpSessions()})`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in HTTP main():', error);
    process.exit(1);
  });
}
