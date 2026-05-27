import { Conversation } from '@sinch/conversation';

export const appendRegionHint = (error: unknown, region: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `${message} If the resource cannot be found, the region parameter may be incorrect. Current region: ${region}.`;
};

export const dormantTriggersWarning =
  'No triggers were configured. The webhook will remain dormant until triggers are added (for example via the Sinch Dashboard).';

export const hasNoTriggers = (triggers: string[] | undefined): boolean =>
  !triggers || triggers.length === 0;

export const buildUpdateMask = (
  body: Conversation.UpdateWebhookRequestBody,
): string[] => {
  const mask: string[] = [];
  if (body.target !== undefined) {
    mask.push('target');
  }
  if (body.triggers !== undefined) {
    mask.push('triggers');
  }
  if (body.target_type !== undefined) {
    mask.push('target_type');
  }
  return mask;
};
