import type { SinchClient } from '@sinch/sdk-core';

export const resolveVoiceServiceId = async (voice: SinchClient['voice']['v2'], serviceId?: string): Promise<string> => {
  if (serviceId) {
    const service = await voice.services.get({ serviceId });
    return service.serviceId;
  }

  const response = await voice.services.list({
    isDefault: true,
    pageSize: 1,
  });
  const defaultService = response.data.find((service) => service.isDefault);

  if (!defaultService) {
    throw new Error('No default Voice service is configured for the authenticated project.');
  }

  return defaultService.serviceId;
};
