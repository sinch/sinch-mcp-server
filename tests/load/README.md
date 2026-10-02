# MCP load test

The k6 scenario uses a constant arrival rate, initializes one MCP session per VU, and then
repeatedly calls `tools/list` or a configured tool.

```bash
MCP_BASE_URL=https://mcp.example.com \
MCP_AUTHORIZATION="Bearer $(printf '%s' 'project:key:secret' | base64)" \
MCP_RATE=25 MCP_DURATION=5m \
k6 run tests/load/mcp.js
```

To include a real Sinch API call:

```bash
MCP_TOOL_NAME=list-conversation-apps \
MCP_TOOL_ARGUMENTS='{}' \
k6 run tests/load/mcp.js
```

Do not commit credentials or put them directly in command history in shared environments. Supply
`MCP_AUTHORIZATION` through the CI secret store for repeatable tests.

The k6 output provides HTTP/MCP end-to-end p95. Use the same test window in the telemetry backend
to compare:

- `mcp.http.duration.ms` p95: ingress-to-MCP response time observed by the app.
- `tool.duration.ms` p95 grouped by `tool.name`: MCP tool processing, including API calls.
- `sinch_api.duration.ms` p95 grouped by `service`, `status`, and `status_code`: downstream Sinch
  API response-header latency.
- `http.client.request.duration` and the child spans produced by Undici: full downstream response
  time and timeout/error details.

Approximate non-API MCP overhead as `tool.duration.ms - sinch_api.duration.ms` for tools making one
serial API call. For tools making multiple or parallel calls, use the trace waterfall rather than
subtracting percentiles.
