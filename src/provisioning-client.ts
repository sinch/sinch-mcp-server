import { HttpStatus } from './http-status';
import { formatUserAgent } from './utils';

const PROVISIONING_HOST = 'https://provisioning.api.sinch.com';

// Shared error-response shape, used to build each client's ApiError via buildApiError().
export interface ProvisioningErrorBody {
  errorCode?: string;
  message?: string;
  resolution?: string;
}

// Base REST client for Sinch provisioning APIs (Basic auth, project-scoped
// paths). Subclasses set the resource segment and their own ApiError type.
export abstract class BaseProvisioningClient {
  protected constructor(
    private readonly resource: string,
    private readonly projectId: string,
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly toolName: string,
  ) {}

  protected abstract buildApiError(status: number, statusText: string, errorCode?: string, resolution?: string): Error;

  private baseUrl(): string {
    return `${PROVISIONING_HOST}/v1/projects/${this.projectId}/${this.resource}`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
      'User-Agent': formatUserAgent(this.toolName, this.projectId),
    };
  }

  private async parseError(response: Response): Promise<Error> {
    let body: ProvisioningErrorBody = {};
    try {
      body = (await response.json()) as ProvisioningErrorBody;
    } catch {
      // ignore JSON parse errors
    }
    return this.buildApiError(response.status, body.message ?? response.statusText, body.errorCode, body.resolution);
  }

  protected async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
}
