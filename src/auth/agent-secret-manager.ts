import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '../telemetry/logger';
import {
  buildAgentM2MSecretId,
  parseSinchCredentialsValue,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';

type SecretManagerClient = {
  getProjectId(): Promise<string>;
  accessSecretVersion(
    request: {
      name: string;
    },
    options?: {
      timeout?: number;
    },
  ): Promise<[{ payload?: { data?: Uint8Array | string | null } | null }, ...unknown[]]>;
};

let client: SecretManagerClient | undefined;

const getClient = (): SecretManagerClient => {
  client ??= new SecretManagerServiceClient() as unknown as SecretManagerClient;
  return client;
};

/**
 * Loads the latest credential version for an agent installation using Google
 * Application Default Credentials. Errors and invalid payloads fail closed;
 * callers receive no details that could expose secret metadata or contents.
 */
export const loadAgentM2MCredentials = async (
  orderId: string,
  projectId: string,
): Promise<SinchOAuthCredentials | undefined> => {
  const secretId = buildAgentM2MSecretId(orderId, projectId);
  if (!secretId) {
    logger.warn({ agent_id: orderId }, 'Invalid agent credential secret identifier');
    return undefined;
  }

  try {
    const secretManager = getClient();
    const googleProjectId = await secretManager.getProjectId();
    const [version] = await secretManager.accessSecretVersion(
      {
        name: `projects/${googleProjectId}/secrets/${secretId}/versions/latest`,
      },
      { timeout: 3_000 },
    );
    const data = version.payload?.data;
    if (!data) {
      logger.warn({ secret_id: secretId, agent_id: orderId }, 'Agent credential secret has no payload');
      return undefined;
    }

    const encodedCredentials = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    const credentials = parseSinchCredentialsValue(encodedCredentials);
    if (!credentials || credentials.projectId !== projectId) {
      logger.warn(
        { secret_id: secretId, agent_id: orderId },
        'Agent credential secret is malformed or belongs to a different project',
      );
      return undefined;
    }

    return credentials;
  } catch (error) {
    logger.warn(
      {
        secret_id: secretId,
        agent_id: orderId,
        error_code:
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : undefined,
      },
      'Unable to load agent credentials from Google Secret Manager',
    );
    return undefined;
  }
};

/** Test-only injection point; avoids creating an authenticated Google client. */
export const setAgentSecretManagerClientForTests = (replacement: SecretManagerClient | undefined): void => {
  client = replacement;
};
