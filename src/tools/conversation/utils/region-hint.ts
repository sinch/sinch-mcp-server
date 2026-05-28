export const appendRegionHint = (error: unknown, region: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `${message} If the resource cannot be found, the region parameter may be incorrect. Current region: ${region}.`;
};
