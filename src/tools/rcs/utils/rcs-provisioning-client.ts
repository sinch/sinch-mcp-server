import { HttpStatus } from '../../../http-status';
import { formatUserAgent } from '../../../utils';
import {
  CapabilitiesResponse,
  CreateSenderRequest,
  ListSendersResponse,
  RcsApiErrorBody,
  RcsSender,
  TestNumberStateResponse,
  TestNumbersResponse,
  UpdateSenderRequest,
} from '../types/rcs-api';

const PROVISIONING_HOST = 'https://provisioning.api.sinch.com';

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

export class RcsProvisioningClient {
  constructor(
    private readonly projectId: string,
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly toolName: string,
  ) {}

  private baseUrl(): string {
    return `${PROVISIONING_HOST}/v1/projects/${this.projectId}/rcs`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
      'User-Agent': formatUserAgent(this.toolName, this.projectId),
    };
  }

  private async parseError(response: Response): Promise<RcsApiError> {
    let body: RcsApiErrorBody = {};
    try {
      body = (await response.json()) as RcsApiErrorBody;
    } catch {
      // ignore JSON parse errors
    }
    return new RcsApiError(response.status, body.message ?? response.statusText, body.errorCode, body.resolution);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: this.headers(),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    if (response.status === HttpStatus.NO_CONTENT) {
      return undefined as T;
    }

    return (await response.json()) as T;
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
