export const TRACER_NAME = 'sinch-mcp-server';
export const METER_NAME = 'sinch-mcp-server';

export const SPAN_TOOL_PREFIX = 'mcp.tool';
export const SPAN_SINCH_API_CALL = 'sinch_api.call';

export const ATTR_TOOL_NAME = 'mcp.tool.name';
export const ATTR_AUTH_METHOD = 'mcp.auth.method';
export const ATTR_PROJECT_ID = 'project.id';
export const ATTR_SINCH_API_SERVICE = 'sinch.api.service';

export const METRIC_TOOL_CALLS_TOTAL = 'tool.calls.total';
export const METRIC_TOOL_ERRORS_TOTAL = 'tool.errors.total';
export const METRIC_TOOL_DURATION_MS = 'tool.duration.ms';
export const METRIC_SINCH_API_DURATION_MS = 'sinch_api.duration.ms';

// the top finite bound matches SINCH_API_TIMEOUT_MS, so slow calls stay distinguishable instead of collapsing past 10s (that is the OTEL behavior).
export const DURATION_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000, 30000, 60000];
