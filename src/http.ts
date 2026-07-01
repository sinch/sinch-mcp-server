import { randomUUID } from 'crypto';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { runWithHttpCredentialHeaders } from './auth/credential-context';
import { setHttpCredentialSource } from './auth/http-credential-mode';
import { createMcpApiKeyMiddleware, loadMcpApiKeys } from './auth/mcp-api-key';
import { getMaxMcpSessions, isMcpSessionCapacityReached } from './auth/http-session-limits';
import { buildJsonRpcErrorResponse } from './json-rpc';
import {
  instantiateMcpServer,
  parseArgs,
  registerCapabilities,
} from './server';

dotenv.config();

const MCP_PATH = '/mcp';
const DEFAULT_PORT = 8000;

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, SessionEntry>();

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

const createSession = async (): Promise<SessionEntry> => {
  const mcpServer = instantiateMcpServer();
  registerCapabilities(mcpServer, parseArgs(process.argv));

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
    setHttpCredentialSource('request-header');
  }

  const runWithCredentials = <T>(req: Request, fn: () => T): T => {
    if (isSingleTenant) {
      return fn();
    }
    return runWithHttpCredentialHeaders(req.headers, fn);
  };

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionId = getSessionId(req);

    if (sessionId) {
      const entry = sessions.get(sessionId);
      if (!entry) {
        res.status(404).json(
          buildJsonRpcErrorResponse(-32001, 'Session not found', req.body),
        );
        return;
      }

      await runWithCredentials(req, () =>
        entry.transport.handleRequest(req, res, req.body),
      );
      return;
    }

    if (!isInitializationBody(req.body)) {
      res.status(400).json(
        buildJsonRpcErrorResponse(
          -32000,
          'Bad Request: No valid session ID provided',
          req.body,
        ),
      );
      return;
    }

    if (isMcpSessionCapacityReached(sessions.size)) {
      res.status(503).json(
        buildJsonRpcErrorResponse(
          -32000,
          'Service Unavailable: maximum number of MCP sessions reached',
          req.body,
        ),
      );
      return;
    }

    const entry = await createSession();
    await runWithCredentials(req, () =>
      entry.transport.handleRequest(req, res, req.body),
    );
  };

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  if (isSingleTenant) {
    app.use(MCP_PATH, createMcpApiKeyMiddleware(mcpApiKeys));
  }

  const routeHandler = (req: Request, res: Response) => {
    void handleMcpRequest(req, res).catch((error) => {
      console.error(`Error handling MCP ${req.method} request:`, error);
      if (!res.headersSent) {
        res.status(500).json(
          buildJsonRpcErrorResponse(-32603, 'Internal server error', req.body),
        );
      }
    });
  };

  app.post(MCP_PATH, routeHandler);
  app.get(MCP_PATH, routeHandler);
  app.delete(MCP_PATH, routeHandler);

  return app;
};

export const main = async (): Promise<void> => {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const app = createHttpApp();

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.error(
        `Sinch MCP HTTP server listening on port ${port} (${MCP_PATH}, max sessions: ${getMaxMcpSessions()})`,
      );
      resolve();
    });

    server.on('error', reject);
  });
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in HTTP main():', error);
    process.exit(1);
  });
}
