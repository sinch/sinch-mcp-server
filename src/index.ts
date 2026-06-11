import './env';
import './telemetry';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  instantiateMcpServer,
  parseArgs,
  registerCapabilities,
} from './server';
import { shutdownTelemetry } from './telemetry';
import { logger } from './telemetry/logger';

export const main = async () => {
  const transport = new StdioServerTransport();
  const server = instantiateMcpServer();
  registerCapabilities(server, parseArgs(process.argv));
  await server.connect(transport);
};

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down`);
  await shutdownTelemetry();
  process.exit(0);
};

if (require.main === module) {
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  main().catch((error) => {
    logger.error({ err: error }, 'Fatal error in main()');
    process.exit(1);
  });
}
