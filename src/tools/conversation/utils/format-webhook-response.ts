import { Conversation } from '@sinch/conversation';

const formatWebhook = (webhook: Conversation.Webhook) => ({
  id: webhook.id,
  app_id: webhook.app_id,
  target: webhook.target,
  target_type: webhook.target_type,
  triggers: webhook.triggers,
});

export const formatWebhookResponse = (webhook: Conversation.Webhook) =>
  formatWebhook(webhook);

export const formatListWebhooksResponse = (
  response: Conversation.ListWebhooksResponse | undefined,
) => {
  if (!response?.webhooks?.length) {
    return { webhooks: [] };
  }
  return {
    webhooks: response.webhooks.map(formatWebhook),
  };
};
