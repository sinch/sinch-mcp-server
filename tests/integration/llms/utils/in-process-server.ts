import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tags } from '../../../../src/types';

export interface RawTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface InProcessServer {
  tools: RawTool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  close: () => Promise<void>;
}

/** Wrap the server's real tool defs as HostRunner tools that execute in-process. */
export const toHostTools = (server: InProcessServer) =>
  server.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (args: Record<string, unknown>) => server.callTool(tool.name, args),
  }));

/**
 * Build the real MCP server in this process and connect to it over an in-memory
 * transport — no child process. Callers register `jest.unstable_mockModule` for
 * the service helpers BEFORE calling this, so the real handlers run against fake
 * clients (see mocks/sinch-fakes.ts). Returns the real tool definitions plus a
 * `callTool` that runs them.
 */
export const startInProcessServer = async (): Promise<InProcessServer> => {
  const { instantiateMcpServer, registerCapabilities } = await import('../../../../src/server');
  const server = instantiateMcpServer();
  registerCapabilities(server, ['all'] as Tags[]);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'llm-tests', version: '0.0.1' });
  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  return {
    tools: tools as RawTool[],
    callTool: (name, args) => client.callTool({ name, arguments: args }),
    close: async () => {
      await client.close();
      await server.close();
    },
  };
};
