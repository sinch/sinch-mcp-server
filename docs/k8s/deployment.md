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

# Auth: staging and prod run multi-tenant — the app holds no Sinch credentials, and

# `MCP_AUTH_MODE` pins which caller-supplied shape each deployment accepts.

# Client credentials always arrive in the `Authorization` header (see "Auth contract" below).

#

# Note: MCP session state is stored in Redis, not in pod memory, so requests can land on

# any pod — no sticky sessions needed. Redis connection details (REDIS_HOST/REDIS_PORT/

# REDIS_PASSWORD) come from `redisConnectionSecret` (chart value) — a separate,

# infra-managed secret (e.g. a Crossplane-provisioned AWS ElastiCache connection secret

# with `endpoint`/`port`/`password` keys), not the app's own `existingSecret`.

# All overlays run replicaCount: 2 with a PodDisruptionBudget.

## Auth contract (`Authorization` header)

`MCP_AUTH_MODE` selects the tenancy, and it is read **first**:

| `MCP_AUTH_MODE`     | Tenancy       | `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` | Tools run as              |
| ------------------- | ------------- | ---------------------------------- | ------------------------- |
| set to a known mode | Multi-tenant  | **never read**                     | whatever the caller sends |
| set to anything else| —             | —                                  | refuses to start          |
| unset               | Single-tenant | **required**, all three            | the env credentials       |

That ordering is the point: the decision rests on one variable the chart always sets, never on
the absence of something. A credential left in the environment — a stale Secret key, a local
`.env` baked into an image — cannot pull a deployed server back onto one shared account, because
in multi-tenant those variables are never consulted for credential resolution, for telemetry, or
for anything else.

When `MCP_AUTH_MODE` is set, it also pins the one inbound shape `/mcp` accepts:

| `MCP_AUTH_MODE`      | `Authorization` header value                                    | Tools run as           |
| -------------------- | --------------------------------------------------------------- |------------------------|
| `client-credentials` | `Bearer <base64(projectId:keyId:keySecret)>` — the caller's own | the credentials sent   |
| `sinchid-agent`      | `Bearer <SinchID access token>`, plus `x-agent-id`              | the `SINCH_AGENT_M2M_<orderId>_<projectId>` env var |

Notes:

- **Single-tenant performs no inbound authentication on `/mcp`.** `MCP_AUTH_MODE` being unset is
  the whole configuration, so there is no per-caller credential to check — anyone who can reach
  the port transacts on that account. It is a local/stdio-equivalent mode and must never be
  exposed. This chart cannot deploy it, because it always sets `MCP_AUTH_MODE`.
- A **partial** triple with `MCP_AUTH_MODE` unset refuses to start: single-tenant needs all three.
  With `MCP_AUTH_MODE` set, a partial triple is simply irrelevant.
- An **unrecognised** `MCP_AUTH_MODE` refuses to start. It does not degrade to single-tenant —
  that would drop inbound auth on an endpoint whose only protection is this middleware.
- Multi-tenant requires `CONVERSATION_REGION`, which cannot be overridden per request.
- Encode `projectId:keyId:keySecret` with standard Base64 (no line breaks, not base64url) and
  send it on every request, including after `initialize`.
- A request carrying the wrong token shape, or a `sinchid-agent` JWT that fails verification, is
  rejected with `401` plus a `WWW-Authenticate` challenge. Where a tool is reached without usable
  credentials it answers with a prompt response:
  `Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").`
- Make sure `Authorization` is passed through to the pod untouched.
- **`sinchid-agent` verifies the `Authorization` JWT** (signature against a JWKS, algorithm pinned
  to `RS256`, issuer, audience, expiry) before trusting any claim from it or letting the request
  through. This requires `SINCHID_JWT_ISSUER`, `SINCHID_JWT_AUDIENCE`, `SINCHID_JWT_JWKS_URI` —
  the server refuses to start without them. The caller's Sinch project ID is derived directly
  from the verified token's `https://sinch.com/project_id` claim, and the installation identifier is
  provided via the `x-agent-id` header.
- On `sinch-mcp-server-agent` (the only release running `sinchid-agent`), each onboarded
  installation needs its own `SINCH_AGENT_M2M_<orderId>_<projectId>` env var (same Base64 blob
  format as `client-credentials`) reaching the pod without ever being committed to this repo.
  This can be injected via the chart's `extraEnvFromSecret` setting.

## Secret skeleton (create in namespace before first deploy)

Do not put `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` in this secret. The chart always sets
`MCP_AUTH_MODE`, so they would be inert rather than dangerous — but they would still be live
Sinch credentials sitting in a namespace with nothing to read them, which is worth avoiding on
its own.

`CONVERSATION_REGION` and `MCP_AUTH_MODE` are chart values (`conversationRegion`, `authMode`),
not secret keys.

Redis is separate: `redisConnectionSecret` (a Helm value, not part of the secret above) must
name a secret with `endpoint`/`port`/`password` keys — normally provisioned automatically
(e.g. by Crossplane), not created by hand. See `k8s-manifests-mcp-messaging` for the actual
`RedisCluster` resource per site.

## Local image smoke test

`REDIS_HOST` is required in every mode — the server exits immediately on startup without it.
The run below reproduces the deployed shape, which additionally needs `MCP_AUTH_MODE` and
`CONVERSATION_REGION`. (To smoke-test single-tenant instead, drop both and pass
`PROJECT_ID`/`KEY_ID`/`KEY_SECRET`.) Run a throwaway Redis on the same Docker network so the
container can reach it by name:

```bash
docker network create mcp-smoke-test
docker run -d --rm --name redis --network mcp-smoke-test redis:8-alpine

docker build -t sinch-mcp-server:local .
docker run --rm -p 8000:8000 --network mcp-smoke-test \
  -e MCP_AUTH_MODE=client-credentials -e CONVERSATION_REGION=eu \
  -e REDIS_HOST=redis \
  sinch-mcp-server:local
curl -s http://127.0.0.1:8000/health/live

docker stop redis
docker network rm mcp-smoke-test
```
