import { spawnSync } from 'node:child_process';

const mockPinoLogger = {
  fatal: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
};
const mockDestination = {};
const mockPino = Object.assign(
  jest.fn(() => mockPinoLogger),
  {
    destination: jest.fn(() => mockDestination),
  },
);

jest.mock('pino', () => ({
  __esModule: true,
  default: mockPino,
}));

const loadLogger = (): typeof import('../../src/telemetry/logger') => {
  let loggerModule: typeof import('../../src/telemetry/logger') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loggerModule = require('../../src/telemetry/logger');
  });
  return loggerModule!;
};

describe('logger', () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LOG_LEVEL;
  });

  afterAll(() => {
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  it('falls back to info so an invalid LOG_LEVEL can be reported', () => {
    process.env.LOG_LEVEL = 'verbose';
    const { logger } = loadLogger();

    logger.error('Invalid environment variables');

    expect(mockPino.destination).toHaveBeenCalledWith(2);
    expect(mockPino).toHaveBeenCalledWith({ level: 'info' }, mockDestination);
    expect(mockPinoLogger.error).toHaveBeenCalledWith({}, 'Invalid environment variables');
  });

  it('logs and rejects an invalid LOG_LEVEL during environment validation', () => {
    const result = spawnSync(process.execPath, ['-r', 'ts-node/register', '-e', "require('./src/env')"], {
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: 'verbose' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"msg":"Invalid environment variables"');
    expect(result.stderr).toContain('Error: Invalid environment variables');
    expect(result.stderr).not.toContain('default level');
  });

  it('uses a valid configured log level', () => {
    process.env.LOG_LEVEL = 'trace';
    const { logger } = loadLogger();

    logger.info('Ready');

    expect(mockPino).toHaveBeenCalledWith({ level: 'trace' }, mockDestination);
  });

  it('exposes fatal and trace log methods', () => {
    const { logger } = loadLogger();

    logger.fatal({ component: 'http' }, 'Fatal failure');
    logger.trace({ request_id: 'request-1' }, 'Request received');

    expect(mockPinoLogger.fatal).toHaveBeenCalledWith({ component: 'http' }, 'Fatal failure');
    expect(mockPinoLogger.trace).toHaveBeenCalledWith({ request_id: 'request-1' }, 'Request received');
  });
});
