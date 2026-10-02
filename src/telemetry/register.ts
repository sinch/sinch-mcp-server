import { initTelemetry } from '.';

// Side-effect module for the HTTP entrypoint only, which must import it before anything else
// so the http/undici instrumentations are registered before those modules load.
//
// stdio never imports this: it runs on the caller's machine, where Sinch's in-cluster
// collector is unreachable. The HTTP server is off too unless OTEL_EXPORTER_OTLP_ENDPOINT is
// set, which only the Helm chart does, on Sinch clusters.
initTelemetry();
