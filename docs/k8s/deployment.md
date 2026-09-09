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

# Auth (staging v1): single-tenant — Secret `sinch-mcp-server` with MCP_API_KEY + Sinch creds.

# Client credentials always arrive in the `Authorization` header (see "Auth contract" below); `X-Sinch-Credentials` is no longer read.

#

# Note: MCP session state is stored in Redis, not in pod memory, so requests can land on

# any pod — no sticky sessions needed. Redis connection details (REDIS_HOST/REDIS_PORT/

# REDIS_PASSWORD) come from `redisConnectionSecret` (chart value) — a separate,

# infra-managed secret (e.g. a Crossplane-provisioned AWS ElastiCache connection secret

# with `endpoint`/`port`/`password` keys), not the app's own `existingSecret`.

# All overlays run replicaCount: 2 with a PodDisruptionBudget.

## Auth contract (`Authorization` header)

Every request to `/mcp` authenticates through the standard `Authorization: Bearer <token>` header.
What the token means depends on the deployment mode, which is selected by whether `MCP_API_KEY`
(or `MCP_API_KEYS`) is present in the app secret:

| Mode          | Server secret                                                  | `Authorization` header value                                               |
| ------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Single-tenant | `MCP_API_KEY` **set**, plus `PROJECT_ID`/`KEY_ID`/`KEY_SECRET` | `Bearer <MCP_API_KEY>` (gateway key; Sinch creds from env)                 |
| Multi-tenant  | `MCP_API_KEY` **unset**, `CONVERSATION_REGION` required        | `Bearer <base64(projectId:keyId:keySecret)>` (client-supplied Sinch creds) |

Multi-tenant notes:

- Encode `projectId:keyId:keySecret` with standard Base64 (no line breaks, not base64url) and
  send it on every request, including after `initialize`.
- A missing/malformed header is not rejected at the HTTP layer; OAuth-backed tools answer with a
  prompt response: `Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").`
- The former `X-Sinch-Credentials` header is **not** accepted (no deprecation window). Any
  ingress/gateway rules that forward or strip that header can be dropped; make sure
  `Authorization` is passed through to the pod untouched.

## Secret skeleton (create in namespace before first deploy)

```bash
kubectl -n mcp-messaging create secret generic sinch-mcp-server \
  --from-literal=MCP_API_KEY='...' \
  --from-literal=PROJECT_ID='...' \
  --from-literal=KEY_ID='...' \
  --from-literal=KEY_SECRET='...' \
  --from-literal=CONVERSATION_REGION='eu' \
  --from-literal=APPLICATION_KEY='...' \
  --from-literal=APPLICATION_SECRET='...' \
  --from-literal=MAILGUN_DOMAIN='...' \
  --from-literal=MAILGUN_API_KEY='...' \
  --from-literal=MAILGUN_SENDER_ADDRESS='...'
```

Redis is separate: `redisConnectionSecret` (a Helm value, not part of the secret above) must
name a secret with `endpoint`/`port`/`password` keys — normally provisioned automatically
(e.g. by Crossplane), not created by hand. See `k8s-manifests-mcp-messaging` for the actual
`RedisCluster` resource per site.

## Local image smoke test

REDIS_HOST is required — the server exits immediately on startup without it. Run a throwaway
Redis on the same Docker network so the container can reach it by name:

```bash
docker network create mcp-smoke-test
docker run -d --rm --name redis --network mcp-smoke-test redis:8-alpine

docker build -t sinch-mcp-server:local .
docker run --rm -p 8000:8000 --network mcp-smoke-test \
  -e MCP_API_KEY=dev \
  -e PROJECT_ID=x -e KEY_ID=x -e KEY_SECRET=x \
  -e REDIS_HOST=redis \
  sinch-mcp-server:local
curl -s http://127.0.0.1:8000/health/live

docker stop redis
docker network rm mcp-smoke-test
```
