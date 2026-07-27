import { BaseProvisioningClient } from '../../../provisioning-client';
import {
  CreateWhatsAppTemplateRequest,
  UpdateWhatsAppTemplateRequest,
  WhatsAppTemplateResponse,
} from '../types/whatsapp-api';

export class WhatsAppApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly errorCode?: string,
    readonly resolution?: string,
  ) {
    super(`WhatsApp API error (${status} ${statusText})`);
    this.name = 'WhatsAppApiError';
  }
}

export class WhatsAppProvisioningClient extends BaseProvisioningClient {
  constructor(projectId: string, keyId: string, keySecret: string, toolName: string) {
    super('whatsapp', projectId, keyId, keySecret, toolName);
  }

  protected buildApiError(
    status: number,
    statusText: string,
    errorCode?: string,
    resolution?: string,
  ): WhatsAppApiError {
    return new WhatsAppApiError(status, statusText, errorCode, resolution);
  }

  createTemplate(body: CreateWhatsAppTemplateRequest): Promise<WhatsAppTemplateResponse> {
    return this.request<WhatsAppTemplateResponse>('POST', '/templates', body);
  }

  updateTemplate(
    templateName: string,
    languageCode: string,
    body: UpdateWhatsAppTemplateRequest,
  ): Promise<WhatsAppTemplateResponse> {
    return this.request<WhatsAppTemplateResponse>(
      'PATCH',
      `/templates/${encodeURIComponent(templateName)}/languages/${encodeURIComponent(languageCode)}`,
      body,
    );
  }
}
