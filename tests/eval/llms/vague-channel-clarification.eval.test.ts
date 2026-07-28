import { defineWorkflowEval } from './utils/workflow-eval-harness';

// Under-specified channel setup: the model must ask which channel (SMS / RCS /
// WhatsApp) and collect credentials — not invent them or call a set-*-channel
// tool. responseIncludes proves the clarification is tool-aware (schema fields),
// not a generic chat reply as if no MCP server were connected.
defineWorkflowEval({
  name: 'Vague channel setup clarification',
  debugFirstIteration: true,
  passRate: 0.8,
  steps: [
    {
      id: 'vague-add-messaging',
      prompt: `Add messaging to Conversation app app-abc123`,
      expectNoTool: true,
      responseIncludes: ['sms'],
    },
    {
      id: 'provide-whatsapp',
      prompt: `WhatsApp — sender id wa-sender-1 and bearer token wa-token-1`,
      accept: ['set-whatsapp-channel-on-app'],
    },
  ],
});
