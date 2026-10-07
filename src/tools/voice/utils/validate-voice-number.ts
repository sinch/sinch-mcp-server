import type { Numbers } from '@sinch/numbers';
import type { SinchClient } from '@sinch/sdk-core';

export const validateActiveVoiceNumber = async (
  numbers: SinchClient['numbers'],
  projectId: string,
  phoneNumber: string,
): Promise<Numbers.ActiveNumber> => {
  const activeNumber = await numbers.get({ phoneNumber });

  if (activeNumber.projectId && activeNumber.projectId !== projectId) {
    throw new Error('The origin phone number does not belong to the authenticated project.');
  }
  if (!activeNumber.capability?.includes('VOICE')) {
    throw new Error('The origin phone number is not enabled for Voice.');
  }
  if (activeNumber.voiceConfiguration?.scheduledVoiceProvisioning) {
    throw new Error(
      `The origin phone number Voice provisioning is not ready: ${activeNumber.voiceConfiguration.scheduledVoiceProvisioning.status}.`,
    );
  }

  return activeNumber;
};
