# MCP Kubernetes deployment notes

#

# Namespace: mcp-messaging

# cg_product: agent_tools

# Staging: eu1tst-eks001, us1tst-eks001

# Production: us1-eks001, eu1-eks001, br1-eks001 (regions: us, eu, br)

#

# App chart lives in this repo under `helm/`.

# GKA / namespace DevOps checklist lives in Confluence under Platform Foundation → MCPs.

#

# Runtime: Streamable HTTP on port 8000, path `/mcp`.

# Probes: `/health/live`, `/health/ready` (no auth).

# Auth: set by `MCP_AUTH_MODE`. Staging runs multi-tenant — the app holds no Sinch credentials.

# Client credentials always arrive in the `Authorization` header (see "Auth contract" below).

#

# Note: MCP session state is stored in Redis, not in pod memory, so requests can land on

# any pod — no sticky sessions needed. Redis connection details (REDIS_HOST/REDIS_PORT/

# REDIS_PASSWORD) come from `redisConnectionSecret` (chart value) — a separate,

# infra-managed secret (e.g. a Crossplane-provisioned AWS ElastiCache connection secret

# with `endpoint`/`port`/`password` keys), not the app's own `existingSecret`.

# All overlays run replicaCount: 2 with a PodDisruptionBudget.

## Auth contract (`Authorization` header)

Every request to `/mcp` authenticates through the standard `Authorization: Bearer <token>` header.
The deployment mode is selected by `MCP_AUTH_MODE` (required; no default), and that also decides
what the token means:

| `MCP_AUTH_MODE`      | Tenancy       | `Authorization` header value                                        | Tools run as           |
| -------------------- | ------------- | ------------------------------------------------------------------- | ---------------------- |
| `server-credentials` | Single-tenant | `Bearer <base64(projectId:keyId:keySecret)>` — must be the server's | the env credentials    |
| `client-credentials` | Multi-tenant  | `Bearer <base64(projectId:keyId:keySecret)>` — the caller's own     | the credentials sent   |
| `sinchid-agent`      | Multi-tenant  | `Bearer <SinchID access token>`, plus `x-agent-id`                  | the agent installation |

Notes:

- Encode `projectId:keyId:keySecret` with standard Base64 (no line breaks, not base64url) and
  send it on every request, including after `initialize`.
- `server-credentials` requires `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` in the app secret and refuses
  to start without them; the comparison against the caller's token is constant-time.
- The multi-tenant modes require `CONVERSATION_REGION` and read no Sinch credentials from env.
- A request carrying the wrong token shape is rejected with `401` plus a `WWW-Authenticate`
  challenge. Where a tool is reached without usable credentials it answers with a prompt response:
  `Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").`
- Make sure `Authorization` is passed through to the pod untouched.
- `MCP_API_KEY` / `MCP_API_KEYS` are gone — the single-tenant gateway key was replaced by the
  credential triple above. They are no longer read at all, so drop them from any secret carried
  over from an earlier deploy.

## Secret skeleton (create in namespace before first deploy)

Multi-tenant deployments (the staging default) need no Sinch credentials at all — add
`PROJECT_ID`/`KEY_ID`/`KEY_SECRET` only for `server-credentials`, and the Verification, Voice
and Mailgun keys only if those tool tags are enabled.

```bash
kubectl -n mcp-messaging create secret generic sinch-mcp-server \
  --from-literal=APPLICATION_KEY='...' \
  --from-literal=APPLICATION_SECRET='...' \
  --from-literal=MAILGUN_DOMAIN='...' \
  --from-literal=MAILGUN_API_KEY='...' \
  --from-literal=MAILGUN_SENDER_ADDRESS='...'
```

`CONVERSATION_REGION` and `MCP_AUTH_MODE` are chart values (`conversationRegion`, `authMode`),
not secret keys.

Redis is separate: `redisConnectionSecret` (a Helm value, not part of the secret above) must
name a secret with `endpoint`/`port`/`password` keys — normally provisioned automatically
(e.g. by Crossplane), not created by hand. See `k8s-manifests-mcp-messaging` for the actual
`RedisCluster` resource per site.

## Local image smoke test

REDIS_HOST and MCP_AUTH_MODE are required — the server exits immediately on startup without
them. Run a throwaway Redis on the same Docker network so the container can reach it by name:

```bash
docker network create mcp-smoke-test
docker run -d --rm --name redis --network mcp-smoke-test redis:8-alpine

docker build -t sinch-mcp-server:local .
docker run --rm -p 8000:8000 --network mcp-smoke-test \
  -e MCP_AUTH_MODE=server-credentials \
  -e PROJECT_ID=x -e KEY_ID=x -e KEY_SECRET=x \
  -e REDIS_HOST=redis \
  sinch-mcp-server:local
curl -s http://127.0.0.1:8000/health/live

docker stop redis
docker network rm mcp-smoke-test
```
