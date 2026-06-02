export const CONVERSATION_APP_SETUP_URI = 'sinch://conversation/app-setup';

export const conversationAppSetupGuide = `# Conversation API app setup

## Typical flow

1. **list-conversation-apps** — See existing apps (and region per app when listed across regions).
2. **create-conversation-app** — Create an app with \`displayName\` and optional \`region\` (\`us\`, \`eu\`, \`br\`). No channels are configured at creation.
3. **set-*-channel-on-app** — Add or replace a channel on that app (same \`region\` as the app and channel resources).

## Channels supported by MCP tools

Use only the MCP tools below (not the raw Conversation API). Required parameters per channel:

- **SMS** — \`set-sms-channel-on-app\`: \`appId\`, \`servicePlanId\`, \`apiToken\`
- **RCS** — \`set-rcs-channel-on-app\`: \`appId\`, \`senderId\`, \`bearerToken\`
- **WhatsApp** — \`set-whatsapp-channel-on-app\`: \`appId\`, \`senderId\`, \`bearerToken\`

## Region

Conversation API is regional. The app, SMS service plan, and channel configuration must use the **same region**. Pass \`region\` on each tool call, or rely on the server default only if you understand which region applies.

## Ambiguous prompts

If the user asks to "add messaging" without naming a channel, **ask which channel** they mean (SMS, RCS, or WhatsApp), then collect the required parameters before calling the matching tool:

- SMS: \`appId\`, \`servicePlanId\`, \`apiToken\`
- RCS: \`appId\`, \`senderId\`, \`bearerToken\`
- WhatsApp: \`appId\`, \`senderId\`, \`bearerToken\`
`;
