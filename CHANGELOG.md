# Changelog

## 0.0.7-alpha

The native Streamable HTTP server is new in this release — `0.0.1-alpha.6` shipped stdio only.

- Added a native Streamable HTTP MCP server on `/mcp`, alongside the existing stdio transport.
- Added `MCP_AUTH_MODE`, which selects the tenancy of the HTTP server and is read before anything else:
  - unset — **single-tenant**. Requires `PROJECT_ID`, `KEY_ID` and `KEY_SECRET`; every call transacts on that account. Performs no inbound authentication on `/mcp`, so it is for local use and must not be exposed.
  - `client-credentials` — **multi-tenant**. Callers send their own credentials as `Authorization: Bearer <base64(projectId:keyId:keySecret)>` and the tools run on those.
  - `sinchid-agent` — **multi-tenant**. Callers send a SinchID access token plus an `x-agent-id` header. Resolving credentials from the agent installation is not implemented yet (DEVEXP-1631).
  - In either multi-tenant mode, `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` are never read — for credential resolution or for span attributes. A value that is set but unrecognised refuses to start rather than falling back to single-tenant.
- `CONVERSATION_REGION` is required in the multi-tenant modes and cannot be overridden per request; it stays optional and prompt-overridable in single-tenant and stdio.
- Added Redis-backed MCP session storage shared across replicas. `REDIS_HOST` and `REDIS_PORT` are required by the HTTP server in every mode.
- Added a Helm chart for deploying the HTTP server.
- **stdio is unaffected by all of the above**: no Redis, no `MCP_AUTH_MODE`, credentials read from the environment exactly as before.
