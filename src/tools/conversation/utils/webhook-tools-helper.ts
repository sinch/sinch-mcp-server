import { SupportedConversationRegion } from '@sinch/sdk-client';

export const appendRegionHint = (error: unknown, region: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  const otherRegions = Object.values(SupportedConversationRegion).filter((r) => r !== region);
  const regionsHint = otherRegions.length > 0
    ? ` Other regions to try: ${otherRegions.join(', ')}.`
    : '';
  return `${message}. If the resource cannot be found, the region parameter may be incorrect. Current region: ${region}.${regionsHint}`;
};

export const buildDormantTriggersWarning = (webhookId: string): string =>
  `This webhook has no triggers and will remain dormant. Use update-webhook with webhookId="${webhookId}" and triggers=[...] to activate it.`;

export const hasNoTriggers = (triggers: string[] | undefined): boolean =>
  !triggers || triggers.length === 0;
