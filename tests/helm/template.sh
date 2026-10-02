#!/usr/bin/env bash
# Renders the chart with `helm template` and checks the OpenTelemetry wiring in
# helm/templates/deployment.yaml. Needs only the helm CLI: `npm run test:helm`.
set -euo pipefail

if ! command -v helm >/dev/null 2>&1; then
  echo "helm CLI not found on PATH — install it first (e.g. 'brew install helm'), then re-run." >&2
  exit 2
fi

CHART="$(cd "$(dirname "$0")/../../helm" && pwd)"
NAMESPACE=mcp-messaging
# The minimum every render needs, unrelated to telemetry.
BASE=(--namespace "$NAMESPACE" --set authMode=client-credentials --set conversationRegion=us
  --set redisConnectionSecret=redis-mcp-config)

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; failures=$((failures + 1)); }

# Prints the value of container env var $1 from a rendered manifest on stdin, or nothing.
env_value() {
  awk -v name="$1" '
    $0 ~ "- name: " name "$" { getline; sub(/.*value: /, ""); gsub(/"/, ""); print; exit }
  '
}

# expect_error <description> <message substring> <release> [helm args...]
expect_error() {
  local description=$1 message=$2 release=$3
  shift 3
  local output
  if output=$(helm template "$release" "$CHART" "${BASE[@]}" "$@" 2>&1); then
    fail "$description (rendered, expected an error)"
  elif grep -qF -- "$message" <<<"$output"; then
    pass "$description"
  else
    fail "$description (wrong error: $output)"
  fi
}

# expect_env <description> <release> <VAR> <expected value, "" = absent> [helm args...]
expect_env() {
  local description=$1 release=$2 var=$3 expected=$4
  shift 4
  local output actual
  if ! output=$(helm template "$release" "$CHART" "${BASE[@]}" "$@" 2>&1); then
    fail "$description (render failed: $output)"
    return
  fi
  actual=$(env_value "$var" <<<"$output")
  if [[ "$actual" == "$expected" ]]; then
    pass "$description"
  else
    fail "$description ($var: expected '${expected}', got '${actual}')"
  fi
}

# expect_rendered_text <description> <expected substring> <release> [helm args...]
expect_rendered_text() {
  local description=$1 expected=$2 release=$3
  shift 3
  local output
  if ! output=$(helm template "$release" "$CHART" "${BASE[@]}" "$@" 2>&1); then
    fail "$description (render failed: $output)"
  elif grep -qF -- "$expected" <<<"$output"; then
    pass "$description"
  else
    fail "$description (missing: $expected)"
  fi
}

COLLECTOR=http://otel-collector.otel-collector.svc.cluster.local:4317

expect_error "defaults without otelEnv fail" \
  "otelEnv is required (production | staging)" sinch-mcp-server
expect_error "an unknown otelEnv fails" \
  "otelEnv must be one of: production, staging." sinch-mcp-server --set otelEnv=prod

expect_env "defaults point at the in-cluster collector" \
  sinch-mcp-server OTEL_EXPORTER_OTLP_ENDPOINT "$COLLECTOR" --set otelEnv=staging
expect_env "otelEnv is passed through as OTEL_ENV" \
  sinch-mcp-server OTEL_ENV production --set otelEnv=production
expect_env "service name is <release>.<namespace>" \
  sinch-mcp-server OTEL_SERVICE_NAME "sinch-mcp-server.$NAMESPACE" --set otelEnv=staging
expect_env "the agent release gets its own service name" \
  sinch-mcp-server-agent OTEL_SERVICE_NAME "sinch-mcp-server-agent.$NAMESPACE" --set otelEnv=staging

# An empty endpoint turns telemetry off: nothing is set, and otelEnv is not required.
for var in OTEL_EXPORTER_OTLP_ENDPOINT OTEL_ENV OTEL_SERVICE_NAME; do
  expect_env "an empty endpoint sets no $var" \
    sinch-mcp-server "$var" "" --set-string otelExporterOtlpEndpoint=
done

expect_rendered_text "hard pod anti-affinity is enabled by default" \
  "requiredDuringSchedulingIgnoredDuringExecution:" sinch-mcp-server --set otelEnv=staging
expect_rendered_text "pod anti-affinity uses the node failure domain" \
  "topologyKey: kubernetes.io/hostname" sinch-mcp-server --set otelEnv=staging

if ((failures > 0)); then
  echo "$failures helm template check(s) failed"
  exit 1
fi
echo "all helm template checks passed"
