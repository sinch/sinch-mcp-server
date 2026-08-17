import { BaseProvisioningClient } from '../../../provisioning-client';
import {
  CapabilitiesResponse,
  CreateSenderRequest,
  ListSendersResponse,
  RcsSender,
  TestNumberStateResponse,
  TestNumbersResponse,
  UpdateSenderRequest,
} from '../types/rcs-api';

export class RcsApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly errorCode?: string,
    readonly resolution?: string,
  ) {
    super(`RCS API error (${status} ${statusText})`);
    this.name = 'RcsApiError';
  }
}

export class RcsProvisioningClient extends BaseProvisioningClient {
  constructor(projectId: string, keyId: string, keySecret: string, toolName: string) {
    super('rcs', projectId, keyId, keySecret, toolName);
  }

  protected buildApiError(status: number, statusText: string, errorCode?: string, resolution?: string): RcsApiError {
    return new RcsApiError(status, statusText, errorCode, resolution);
  }

  listSenders(pageToken?: string): Promise<ListSendersResponse> {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request<ListSendersResponse>('GET', `/senders${query}`);
  }

  getSender(senderId: string): Promise<RcsSender> {
    return this.request<RcsSender>('GET', `/senders/${encodeURIComponent(senderId)}`);
  }

  createSender(body: CreateSenderRequest): Promise<RcsSender> {
    return this.request<RcsSender>('POST', '/senders', body);
  }

  updateSender(senderId: string, body: UpdateSenderRequest): Promise<RcsSender> {
    return this.request<RcsSender>('PATCH', `/senders/${encodeURIComponent(senderId)}`, body);
  }

  addTestNumbers(senderId: string, testNumbers: string[]): Promise<TestNumbersResponse> {
    return this.request<TestNumbersResponse>('POST', `/senders/${encodeURIComponent(senderId)}/testNumbers`, {
      testNumbers,
    });
  }

  getTestNumberState(senderId: string, testNumber: string): Promise<TestNumberStateResponse> {
    return this.request<TestNumberStateResponse>(
      'GET',
      `/senders/${encodeURIComponent(senderId)}/testNumbers/${encodeURIComponent(testNumber)}`,
    );
  }

  deleteTestNumber(senderId: string, testNumber: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/senders/${encodeURIComponent(senderId)}/testNumbers/${encodeURIComponent(testNumber)}`,
    );
  }

  resendTestNumberInvite(senderId: string, testNumber: string): Promise<TestNumberStateResponse> {
    return this.request<TestNumberStateResponse>(
      'GET',
      `/senders/${encodeURIComponent(senderId)}/testNumbers/${encodeURIComponent(testNumber)}/retry`,
    );
  }

  getTestNumberCapabilities(senderId: string, testNumber: string): Promise<CapabilitiesResponse> {
    return this.request<CapabilitiesResponse>(
      'GET',
      `/senders/${encodeURIComponent(senderId)}/testNumbers/${encodeURIComponent(testNumber)}/capabilities`,
    );
  }

  launchSender(senderId: string): Promise<RcsSender> {
    return this.request<RcsSender>('POST', `/senders/${encodeURIComponent(senderId)}/launch`, {});
  }
}
