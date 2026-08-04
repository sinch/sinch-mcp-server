import { WhatsAppApiError } from './whatsapp-provisioning-client';

export const formatWhatsAppError = (error: unknown): string => {
  if (error instanceof WhatsAppApiError) {
    const parts = [`HTTP ${error.status}: ${error.message}`];
    if (error.errorCode) {
      parts.push(`errorCode=${error.errorCode}`);
    }
    if (error.resolution) {
      parts.push(error.resolution);
    }
    return parts.join(' ');
  }

  return error instanceof Error ? error.message : String(error);
};
