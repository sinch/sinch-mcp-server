# Changelog

## 0.0.1-beta.7

This release covers everything since `0.0.1-alpha.6`. It adds 37 tools, removes 3, and renames none.

### Added — RCS Provisioning tools

- `list-rcs-senders`, `get-rcs-sender`, `create-rcs-sender`, `update-rcs-sender` and `launch-rcs-sender` manage the life cycle of an RCS sender, from creation to launch.
- `add-rcs-test-number`, `delete-rcs-test-number`, `resend-rcs-test-number-invite` and `get-rcs-test-number-state` manage the test numbers invited to a sender before launch.
- `get-rcs-number-capabilities` reports whether a phone number can receive RCS.
- Added an `rcs-campaign-setup-guide` MCP resource that walks a client through the launch flow.

### Added — WhatsApp tools

- `get-whatsapp-account` returns the status of the WhatsApp Business account linked to the project.
- `list-whatsapp-templates`, `create-whatsapp-template` and `update-whatsapp-template` manage WhatsApp message templates.
- `delete-single-whatsapp-template-language` removes one language from a template; `delete-all-whatsapp-template-languages` removes the whole template.

### Added — Conversation tools

- `create-conversation-app`, `update-conversation-app` and `delete-conversation-app` manage Conversation apps.
- `set-sms-channel-on-app`, `set-rcs-channel-on-app` and `set-whatsapp-channel-on-app` configure channel credentials on an existing app.
- `list-webhooks`, `get-webhook`, `create-webhook`, `update-webhook` and `delete-webhook` manage Conversation API webhooks.
- Added a `conversation-app-setup-guide` MCP resource that walks a client through creating an app and attaching a channel.

### Added — Voice tools

- Migrated Voice call tools to Voice API v2 with project OAuth credentials and optional Voice Service selection.
- `list-calls` and `get-session-information` inspect calls and the legs of a session.
- `create-voice-service`, `assign-number-to-voice-service`, `set-voice-service-webhook` and `remove-voice-service-webhook` provision a Voice Service.
- `tts-batch-callout` places a batch of text-to-speech calls; `get-voice-batch-summary` returns its progress.

### Added — Numbers tools

- `get-rented-number-configuration` returns the current SMS and Voice configuration of a rented number.
- `release-rented-number` cancels a rented number.

### Added — configuration

- `MCP_TAGS` is read as a fallback for the `--tags` option, so the tool allow-list can be set from the environment when the client cannot pass arguments.
- `LOG_LEVEL` sets the log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`). An unknown value falls back to `info` and logs a warning.
- Added an Apache 2.0 `LICENSE` file. The package was already declared as Apache-2.0.

### Changed

- Tool results that report a failure now set `isError: true` on the MCP response, so clients can tell an error from a normal answer without parsing the text.
- Logs are now structured JSON written to stderr, with the trace and span id attached when a span is active. They went through `console` before.
- Environment variables are validated once at startup against a typed schema. An invalid value stops the server instead of failing later inside a tool call.
- **Breaking for `CONVERSATION_REGION`:** the accepted values are now `us`, `eu` and `br`. Anything else is a startup error; before, an unknown region reached the API and failed per call.
- `list-messaging-templates` returns only the templates of the configured region.
- Supported Node.js versions widened to `>=20.18.1 <27.0.0`.
- Dependencies are pinned to exact versions. `@modelcontextprotocol/sdk` moved to `1.32.1` and `@sinch/sdk-core` to `1.6.0`.

### Removed

- **Breaking:** Removed `conference-callout`, `manage-conference-participant` and `close-conference`. They relied on Voice API v1 application credentials, and will return on Voice API v2 with project credentials once conferences are available there (planned Q1 2027).

### Breaking changes

- **`tts-callout`:** `phoneNumber` must now be a valid E.164 number (for example, `+14155550123`). Values in local or non-E.164 formats that were previously accepted by the tool schema are now rejected before the API request is made.
- **Voice credentials:** the Voice tools now use the project credentials (`PROJECT_ID`, `KEY_ID`, `KEY_SECRET`). `APPLICATION_KEY` and `APPLICATION_SECRET` are only used by the Verification tools.
- **stdio:** the server no longer exports OpenTelemetry traces or metrics, even with `OTEL_EXPORTER_OTLP_ENDPOINT` set. Tool spans and metrics go to the no-op `@opentelemetry/api` providers.
