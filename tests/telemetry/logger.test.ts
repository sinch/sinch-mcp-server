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

  it('defaults an undefined LOG_LEVEL to info in one place', () => {
    const { logger, normalizeLogLevel } = loadLogger();

    logger.info('Started');

    expect(normalizeLogLevel(undefined)).toBe('info');
    expect(mockPino).toHaveBeenCalledWith({ level: 'info' }, mockDestination);
    expect(mockPinoLogger.warn).not.toHaveBeenCalled();
  });

  it('falls back to info and warns when LOG_LEVEL is invalid', () => {
    process.env.LOG_LEVEL = 'verbose';
    const { logger, LOG_LEVELS } = loadLogger();

    logger.info('Started');

    expect(mockPino.destination).toHaveBeenCalledWith(2);
    expect(mockPino).toHaveBeenCalledWith({ level: 'info' }, mockDestination);
    expect(mockPinoLogger.warn).toHaveBeenCalledWith(
      {
        configured_log_level: 'verbose',
        fallback_log_level: 'info',
        valid_log_levels: LOG_LEVELS,
      },
      'LOG_LEVEL="verbose" is not a valid level; using "info". Valid: fatal, error, warn, info, debug, trace, silent',
    );
    expect(mockPinoLogger.info).toHaveBeenCalledWith({}, 'Started');
  });

  it('starts successfully and warns when LOG_LEVEL is invalid', () => {
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-e',
        "require('./src/env'); require('./src/telemetry/logger').logger.info('Started')",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, LOG_LEVEL: 'verbose' },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'LOG_LEVEL=\\"verbose\\" is not a valid level; using \\"info\\". Valid: fatal, error, warn, info, debug, trace, silent',
    );
    expect(result.stderr).toContain('"msg":"Started"');
  });

  it('accepts configured log levels case-insensitively', () => {
    process.env.LOG_LEVEL = 'TrAcE';
    const { logger } = loadLogger();

    logger.info('Ready');

    expect(mockPino).toHaveBeenCalledWith({ level: 'trace' }, mockDestination);
  });

  it('delegates every exported log method', () => {
    const { logger, LOG_LEVELS } = loadLogger();

    for (const level of LOG_LEVELS) {
      if (level === 'silent') {
        continue;
      }
      logger[level]({ level }, `${level} message`);
      expect(mockPinoLogger[level]).toHaveBeenCalledWith({ level }, `${level} message`);
    }
    expect(logger).not.toHaveProperty('silent');
  });
});
