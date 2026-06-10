# Hosted OpenTelemetry deployment (K8s)

This MCP server exports traces and metrics via OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
Local stdio usage does not require any telemetry configuration.

## Sinch collector integration

In Sinch Kubernetes clusters, telemetry is collected by the Alloy DaemonSet in the
`otel-collector` namespace. Applications export OTLP gRPC to:

```
http://alloy-daemonset.otel-collector.svc.cluster.local:4317
```

Recommended pod configuration:

- Set Kyverno annotation: `kyverno.sinch.com/add-otel-endpoint: "enabled"`
- Or set environment variables explicitly (see `.template.env`)

Traces flow: **App → cluster-local Alloy → Kafka → tools cluster → Grafana Tempo**

## PII handling

Do not put phone numbers, message bodies, or credentials in span attributes.
The Sinch collector should run a `sanitize` processor before export to backends.

## Validation

After deployment to staging, verify traces in Grafana Tempo:

- Service name: `OTEL_SERVICE_NAME` (default `sinch-mcp-server`)
- Span name pattern: `mcp.tool/{tool-name}`
- Dashboard: [MCP server activity](https://grafana.int.prod.sinch.com/d/eabba2bc-a579-4010-9d6d-0a060f112cdc/mcp-server-activity)

## Coordination

Contact Platform Foundation / InfraOps for:

- Collector endpoint and network policy in your target cluster
- Kyverno annotation on the MCP server deployment
- Sanitize processor configuration on the collector

Reference: [Road to production](https://sinchenterprise.atlassian.net/wiki/spaces/PF/pages/1738571797/Road+to+production)
