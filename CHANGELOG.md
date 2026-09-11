# Changelog

## 0.0.7-alpha

- **Breaking:** removed `MCP_API_KEY` / `MCP_API_KEYS`. Single-tenant HTTP remains, but callers now authenticate by presenting the deployment's own `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` as `Authorization: Bearer <base64(projectId:keyId:keySecret)>` — the separate gateway key was redundant with credentials the server already holds. Both variables are now ignored entirely; remove them from your deployment secrets.
- **Breaking:** `MCP_AUTH_MODE` is now required for every HTTP deployment and selects the mode. It gains a third value, `server-credentials`, which is single-tenant; `client-credentials` and `sinchid-agent` stay multi-tenant. Mode is no longer inferred from the presence of a secret.

- Multi-tenant HTTP deployments now read Sinch OAuth credentials from `Authorization: Bearer <base64(projectId:keyId:keySecret)>`.
- Updated the HTTP deployment documentation and environment template to describe the `Authorization` credential contract.
- Added tests for valid, missing, and malformed multi-tenant credential headers.
