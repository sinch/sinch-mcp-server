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

#

# Note: MCP session state is stored in Redis (REDIS_URL, part of the existingSecret),

# not in pod memory, so requests can land on any pod — no sticky sessions needed.

# All overlays run replicaCount: 2 with a PodDisruptionBudget.

## Secret skeleton (create in namespace before first deploy)

```bash
kubectl -n mcp-messaging create secret generic sinch-mcp-server \
  --from-literal=MCP_API_KEY='...' \
  --from-literal=REDIS_URL='redis://...' \
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

## Local image smoke test

REDIS_URL is required — the server exits immediately on startup without it. Run a throwaway
Redis on the same Docker network so the container can reach it by name:

```bash
docker network create mcp-smoke-test
docker run -d --rm --name redis --network mcp-smoke-test redis:8-alpine

docker build -t sinch-mcp-server:local .
docker run --rm -p 8000:8000 --network mcp-smoke-test \
  -e MCP_API_KEY=dev \
  -e PROJECT_ID=x -e KEY_ID=x -e KEY_SECRET=x \
  -e REDIS_URL=redis://redis:6379 \
  sinch-mcp-server:local
curl -s http://127.0.0.1:8000/health/live

docker stop redis
docker network rm mcp-smoke-test
```
