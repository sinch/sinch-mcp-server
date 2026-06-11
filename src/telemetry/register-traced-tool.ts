import {
  McpServer,
  RegisteredTool,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ZodRawShape } from 'zod';
import {
  ATTR_AUTH_METHOD,
  ATTR_PROJECT_ID,
  ATTR_TOOL_NAME,
  SPAN_TOOL_PREFIX,
  TRACER_NAME,
} from './constants';
import { env } from '../env';
import { getToolMetrics } from './metrics';

const tracer = trace.getTracer(TRACER_NAME);

const resolveAuthMethod = (): string => {
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

const runWithTracing = async <T>(
  toolName: string,
  handler: () => T | Promise<T>,
): Promise<T> => {
  const metrics = getToolMetrics();
  const start = performance.now();

  return tracer.startActiveSpan(`${SPAN_TOOL_PREFIX}/${toolName}`, async (span) => {
    span.setAttribute(ATTR_TOOL_NAME, toolName);
    span.setAttribute(ATTR_AUTH_METHOD, resolveAuthMethod());

    const projectId = env.PROJECT_ID;
    if (projectId) {
      span.setAttribute(ATTR_PROJECT_ID, projectId);
    }

    try {
      const result = await handler();
      span.setStatus({ code: SpanStatusCode.OK });
      metrics.toolCallsTotal.add(1, {
        'tool.name': toolName,
        status: 'success',
      });
      return result;
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      metrics.toolCallsTotal.add(1, {
        'tool.name': toolName,
        status: 'error',
      });
      metrics.toolErrorsTotal.add(1, {
        'tool.name': toolName,
        'error.type': error instanceof Error ? error.name : 'Error',
      });
      throw error;
    } finally {
      metrics.toolDurationMs.record(performance.now() - start, {
        'tool.name': toolName,
      });
      span.end();
    }
  });
};

type ToolConfig<InputArgs extends ZodRawShape> = {
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  outputSchema?: InputArgs;
  annotations?: Record<string, unknown>;
};

export const registerTracedTool = <InputArgs extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: ToolConfig<InputArgs>,
  cb: ToolCallback<InputArgs>,
): RegisteredTool =>
  server.registerTool(
    name,
    config,
    ((args, extra) =>
      runWithTracing(name, () => cb(args, extra))) as ToolCallback<InputArgs>,
  );
