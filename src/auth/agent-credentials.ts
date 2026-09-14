import { z } from 'zod';
import { env } from '../env';
import { buildCredentialCacheKey, type SinchOAuthCredentials } from './sinch-oauth-credentials';

/**
 * The AGENT_CREDENTIALS environment variable holds the map of known agent
 * installations to their Sinch M2M credentials. The key combines the OrderId
 * sent in x-agent-id with the projectId supplied by the upstream-authenticated
 * user JWT:
 *
 *   {
 *     "<orderId>:<projectId>": {
 *       "accessKeyId": "...",
 *       "accessKeySecret": "..."
 *     }
 *   }
 *
 * Temporary mechanism until a token-exchange capability is available over M2M
 * authentication, at which point the user JWT will be exchanged for an M2M
 * JWT and this map will go away.
 */
export const AGENT_CREDENTIALS_ENV_VAR = 'AGENT_CREDENTIALS';

const agentCredentialsEntrySchema = z.object({
  accessKeyId: z.string().trim().min(1),
  accessKeySecret: z.string().trim().min(1),
});

const agentCredentialsMapKeySchema = z
  .string()
  .trim()
  .refine((key) => {
    const separator = key.lastIndexOf(':');
    return separator > 0 && separator < key.length - 1;
  }, 'Expected an orderId:projectId key');

const agentCredentialsMapSchema = z.record(agentCredentialsMapKeySchema, agentCredentialsEntrySchema);

type AgentCredentialsEntry = z.infer<typeof agentCredentialsEntrySchema>;
type AgentCredentialsMap = ReadonlyMap<string, AgentCredentialsEntry>;

const EMPTY_MAP: AgentCredentialsMap = new Map();

let cachedCredentialsByAgentAndProject: AgentCredentialsMap | undefined;

const findDuplicateTrimmedKey = (keys: string[]): string | undefined => {
  const seen = new Set<string>();
  for (const key of keys) {
    const trimmed = key.trim();
    if (seen.has(trimmed)) {
      return trimmed;
    }
    seen.add(trimmed);
  }
  return undefined;
};

const parseAgentCredentials = (rawValue: string): AgentCredentialsMap => {
  let json: unknown;
  try {
    json = JSON.parse(rawValue);
  } catch {
    throw new Error(
      `${AGENT_CREDENTIALS_ENV_VAR} is not valid JSON. ` +
        'Expected a map of orderId:projectId keys to { accessKeyId, accessKeySecret } objects.',
    );
  }

  const parsed = agentCredentialsMapSchema.safeParse(json);
  if (!parsed.success) {
    // Report offending map keys and fields only; never echo credential values.
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`${AGENT_CREDENTIALS_ENV_VAR} has an invalid shape: ${issues.join('; ')}`);
  }

  // Zod already trims the record keys, silently keeping the last entry when two raw
  // keys collapse to the same trimmed id — detect that on the raw keys instead.
  const duplicateAgentId = findDuplicateTrimmedKey(Object.keys(json as Record<string, unknown>));
  if (duplicateAgentId !== undefined) {
    throw new Error(`${AGENT_CREDENTIALS_ENV_VAR} contains duplicate agent id "${duplicateAgentId}" after trimming.`);
  }

  return new Map(Object.entries(parsed.data));
};

/**
 * Parses AGENT_CREDENTIALS once and caches the result for O(1) per-request
 * lookups. Throws on a malformed value: call it at server startup so a bad
 * configuration refuses to start instead of failing on the first request.
 */
export const loadAgentCredentials = (): AgentCredentialsMap => {
  if (!cachedCredentialsByAgentAndProject) {
    const rawValue = env.AGENT_CREDENTIALS?.trim();
    cachedCredentialsByAgentAndProject = rawValue ? parseAgentCredentials(rawValue) : EMPTY_MAP;
  }
  return cachedCredentialsByAgentAndProject;
};

export const resolveAgentCredentials = (agentId: string, projectId: string): SinchOAuthCredentials | undefined => {
  const entry = loadAgentCredentials().get(`${agentId}:${projectId}`);
  if (!entry) {
    return undefined;
  }
  return {
    projectId,
    keyId: entry.accessKeyId,
    keySecret: entry.accessKeySecret,
    cacheKey: buildCredentialCacheKey(projectId, entry.accessKeyId, entry.accessKeySecret),
  };
};

export const clearAgentCredentialsCacheForTests = (): void => {
  cachedCredentialsByAgentAndProject = undefined;
};
