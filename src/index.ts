import './env';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { instantiateMcpServer, getToolsFilter, registerCapabilities } from './server';
// No telemetry SDK here: stdio runs on the caller's machine, where Sinch's collector is
// unreachable. Tool spans and metrics go to the no-op @opentelemetry/api providers.
import { logger } from './telemetry/logger';

export const main = async () => {
  const transport = new StdioServerTransport();
  const server = instantiateMcpServer();
  registerCapabilities(server, getToolsFilter(process.argv));
  await server.connect(transport);
};

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down`);
  process.exit(0);
};

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  main().catch((error) => {
    logger.error({ err: error }, 'Fatal error in main()');
    process.exit(1);
  });
}
