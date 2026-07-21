# MCP Kubernetes deployment notes
#
# Confirmed defaults (replace if MR !3834 differs):
#   Namespace:        mcp-messaging
#   Staging site:     eu1tst-eks001
#   Prod site (later): us1-eks001
#   cg_product:       mcp_messaging  (BLOCKED until allow-listed)
#
# App chart lives in this repo under `helm/`.
# Shared infra (DB/Kafka/ingress) would go in:
#   https://gitlab.com/sinch/sinch-projects/product/agent-experience/k8s-manifests-mcp-messaging/
#
# Runtime: Streamable HTTP on port 8000, path `/mcp`.
# Probes: `/health/live`, `/health/ready` (no auth).
# Auth (staging v1): single-tenant — Secret `sinch-mcp-server` with MCP_API_KEY + Sinch creds.

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

## Local image smoke test

```bash
docker build -t sinch-mcp-server:local .
docker run --rm -p 8000:8000 \
  -e MCP_API_KEY=dev \
  -e PROJECT_ID=x -e KEY_ID=x -e KEY_SECRET=x \
  sinch-mcp-server:local
curl -s http://127.0.0.1:8000/health/live
```
