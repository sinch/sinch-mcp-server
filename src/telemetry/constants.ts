export const TRACER_NAME = 'sinch-mcp-server';
export const METER_NAME = 'sinch-mcp-server';

export const SPAN_TOOL_PREFIX = 'mcp.tool';
export const SPAN_SINCH_API_CALL = 'sinch_api.call';

export const ATTR_TOOL_NAME = 'mcp.tool.name';
export const ATTR_AUTH_METHOD = 'mcp.auth.method';
export const ATTR_PROJECT_ID = 'project.id';
export const ATTR_SINCH_API_SERVICE = 'sinch.api.service';
export const ATTR_SESSION_ID = 'mcp.session.id';

export const METRIC_TOOL_CALLS_TOTAL = 'tool.calls.total';
export const METRIC_TOOL_ERRORS_TOTAL = 'tool.errors.total';
export const METRIC_TOOL_DURATION_MS = 'tool.duration.ms';
export const METRIC_SINCH_API_DURATION_MS = 'sinch_api.duration.ms';
export const METRIC_HTTP_REQUESTS_TOTAL = 'mcp.http.requests.total';
export const METRIC_HTTP_ERRORS_TOTAL = 'mcp.http.errors.total';
export const METRIC_HTTP_DURATION_MS = 'mcp.http.duration.ms';
export const METRIC_HTTP_ACTIVE_REQUESTS = 'mcp.http.active_requests';
export const METRIC_HTTP_ACTIVE_CONNECTIONS = 'mcp.http.active_connections';
export const METRIC_SESSIONS_CREATED_TOTAL = 'mcp.sessions.created.total';
export const METRIC_SESSIONS_DELETED_TOTAL = 'mcp.sessions.deleted.total';
export const METRIC_SESSIONS_ACTIVE = 'mcp.sessions.active';
export const METRIC_REDIS_OPERATIONS_TOTAL = 'redis.operations.total';
export const METRIC_REDIS_FAILURES_TOTAL = 'redis.connection_failures.total';
export const METRIC_REDIS_DURATION_MS = 'redis.operation.duration.ms';
export const METRIC_REDIS_AVAILABLE = 'redis.available';
