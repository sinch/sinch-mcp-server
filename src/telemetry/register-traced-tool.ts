import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ZodRawShape } from 'zod';
import { ATTR_AUTH_METHOD, ATTR_PROJECT_ID, ATTR_TOOL_NAME, SPAN_TOOL_PREFIX, TRACER_NAME } from './constants';
import { getAuthMode } from '../auth/auth-mode';
import { getRequestSinchOAuthCredentials } from '../auth/credential-context';
import { env } from '../env';
import { getToolMetrics } from './metrics';

const tracer = trace.getTracer(TRACER_NAME);

/**
 * An auth mode is set only on a multi-tenant deployment, where the server holds no credentials
 * of its own and the mode names how the caller authenticated. The env-credential branches below
 * describe a single-tenant or stdio process and must not be consulted otherwise — reading
 * PROJECT_ID there would report the server's own account for somebody else's call.
 */
const resolveAuthMethod = (): string => {
  const authMode = getAuthMode();
  if (authMode) {
    return authMode;
  }
  if (env.PROJECT_ID && env.KEY_ID && env.KEY_SECRET) {
    return 'oauth2_project_credentials';
  }
  if (env.APPLICATION_KEY && env.APPLICATION_SECRET) {
    return 'application_signing';
  }
  if (env.MAILGUN_API_KEY) {
    return 'mailgun_api_key';
  }
  return 'unconfigured';
};

/**
 * Multi-tenant: the project is whoever called, resolved per request from the Authorization
 * header — never the environment. Undefined on a sinchid-agent deployment, where credentials
 * come from the agent installation and that lookup does not exist yet (DEVEXP-1631).
 */
const resolveSpanProjectId = (): string | undefined => {
  if (getAuthMode()) {
    return getRequestSinchOAuthCredentials()?.projectId;
  }
  return env.PROJECT_ID;
};

const isErrorResult = (result: unknown): boolean =>
  typeof result === 'object' && result !== null && (result as { isError?: unknown }).isError === true;

// Tools report failures as `{"success":false,...}` JSON text instead of throwing.
const reportsFailure = (result: unknown): boolean => {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const content = (result as { content?: unknown }).content;
  const text = Array.isArray(content) ? (content[0] as { text?: unknown } | undefined)?.text : undefined;
  if (typeof text !== 'string' || !text.includes('"success":false')) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && (parsed as { success?: unknown }).success === false;
  } catch {
    return false;
  }
};

const runWithTracing = async <T>(toolName: string, handler: () => T | Promise<T>): Promise<T> => {
  const metrics = getToolMetrics();
  const start = performance.now();

  return tracer.startActiveSpan(`${SPAN_TOOL_PREFIX}/${toolName}`, async (span) => {
    span.setAttribute(ATTR_TOOL_NAME, toolName);
    span.setAttribute(ATTR_AUTH_METHOD, resolveAuthMethod());

    const projectId = resolveSpanProjectId();
    if (projectId) {
      span.setAttribute(ATTR_PROJECT_ID, projectId);
    }

    const recordError = (errorType: string) => {
      span.setStatus({ code: SpanStatusCode.ERROR });
      metrics.toolCallsTotal.add(1, {
        'tool.name': toolName,
        status: 'error',
      });
      metrics.toolErrorsTotal.add(1, {
        'tool.name': toolName,
        'error.type': errorType,
      });
    };

    try {
      const result = await handler();
      if (isErrorResult(result)) {
        recordError('ToolResultError');
        return result;
      }
      if (reportsFailure(result)) {
        recordError('ToolResultError');
        return { ...result, isError: true };
      }
      span.setStatus({ code: SpanStatusCode.OK });
      metrics.toolCallsTotal.add(1, {
        'tool.name': toolName,
        status: 'success',
      });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      recordError(error instanceof Error ? error.name : 'Error');
      throw error;
    } finally {
      metrics.toolDurationMs.record(performance.now() - start, {
        'tool.name': toolName,
      });
      span.end();
    }
  });
};

type ToolConfig = {
  title?: string;
  description?: string;
  inputSchema?: ZodRawShape;
  outputSchema?: ZodRawShape;
  annotations?: Record<string, unknown>;
};

// Avoid ToolCallback<Schema> generics — they hit TS2589 (excessively deep Zod instantiation).
type ToolHandler = (args: never, extra: never) => unknown;

type RegisterToolFn = (name: string, config: ToolConfig, cb: ToolHandler) => RegisteredTool;

export const registerTracedTool = (
  server: McpServer,
  name: string,
  config: ToolConfig,
  cb: ToolHandler,
): RegisteredTool => {
  const registerTool = server.registerTool.bind(server) as RegisterToolFn;
  return registerTool(name, config, (args, extra) => runWithTracing(name, () => cb(args, extra)));
};
