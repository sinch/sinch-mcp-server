import { randomUUID } from 'crypto';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { createMcpApiKeyMiddleware, loadMcpApiKeys } from './auth/mcp-api-key';
import { runWithHttpCredentialHeaders } from './auth/credential-context';
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

const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
  const sessionId = getSessionId(req);

  if (sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found',
        },
        id: null,
      });
      return;
    }

    await runWithHttpCredentialHeaders(req.headers, () =>
      entry.transport.handleRequest(req, res, req.body),
    );
    return;
  }

  if (!isInitializationBody(req.body)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  const entry = await createSession();
  await runWithHttpCredentialHeaders(req.headers, () =>
    entry.transport.handleRequest(req, res, req.body),
  );
};

export const createHttpApp = () => {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(MCP_PATH, createMcpApiKeyMiddleware(loadMcpApiKeys()));

  const routeHandler = (req: Request, res: Response) => {
    void handleMcpRequest(req, res).catch((error) => {
      console.error(`Error handling MCP ${req.method} request:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
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
      console.error(`Sinch MCP HTTP server listening on port ${port} (${MCP_PATH})`);
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
