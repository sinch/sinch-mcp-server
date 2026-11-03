import axios, { AxiosError, AxiosHeaders } from 'axios';
import { logger } from '../../src/telemetry/logger';
import { formatAppResponse } from '../../src/tools/conversation/utils/format-app-response';
import { formatWebhook } from '../../src/tools/conversation/utils/format-webhook-response';
import { getLatitudeLongitudeFromAddress } from '../../src/tools/conversation/utils/geocoding';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

const FAKE_KEY_SECRET = 'FAKE_KEY_SECRET_123';
const FAKE_CREDENTIALS_BLOB = Buffer.from(`fake-project:fake-key-id:${FAKE_KEY_SECRET}`).toString('base64');
const FAKE_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJmYWtlIjoiRkFLRV9KV1RfUEFZTE9BRCJ9.FAKE_JWT_SIGNATURE';
const FAKE_GOOGLE_KEY = 'AIzaSyFAKE_GOOGLE_KEY_456';
const FAKE_WEBHOOK_SECRET = 'FAKE_WEBHOOK_SECRET_789';
const FAKE_CHANNEL_TOKEN = 'FAKE_CHANNEL_TOKEN_321';

const FAKE_SECRETS = [
  FAKE_KEY_SECRET,
  FAKE_CREDENTIALS_BLOB,
  FAKE_JWT,
  FAKE_GOOGLE_KEY,
  FAKE_WEBHOOK_SECRET,
  FAKE_CHANNEL_TOKEN,
];

const mockLines: string[] = [];
const mockStream = {
  write: (chunk: string) => {
    mockLines.push(chunk);
  },
};

jest.mock('pino', () => {
  const actual = jest.requireActual('pino');
  const wrapped = Object.assign((options: object) => actual(options, mockStream), actual, {
    destination: () => mockStream,
  });
  return { __esModule: true, default: wrapped };
});

const output = (): string => mockLines.join('');

const leaked = (text: string): string[] => FAKE_SECRETS.filter((secret) => text.includes(secret));

const buildAxiosError = (): AxiosError => {
  const config = {
    url: 'https://maps.googleapis.com/maps/api/geocode/json',
    method: 'get',
    params: { address: 'somewhere', key: FAKE_GOOGLE_KEY },
    headers: new AxiosHeaders({ Authorization: `Bearer ${FAKE_JWT}` }),
  };
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    config,
    {
      path: `/maps/api/geocode/json?key=${FAKE_GOOGLE_KEY}`,
    },
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config,
      data: {},
    },
  );
};

describe('log redaction', () => {
  beforeEach(() => {
    mockLines.length = 0;
    resetMockEnv();
  });

  it('redacts credential fields on logged objects', () => {
    logger.info({
      authorization: `Bearer ${FAKE_CREDENTIALS_BLOB}`,
      headers: { authorization: `Bearer ${FAKE_JWT}` },
      request: { headers: { Authorization: `Bearer ${FAKE_JWT}`, 'x-api-key': FAKE_GOOGLE_KEY } },
      password: FAKE_KEY_SECRET,
      keySecret: FAKE_KEY_SECRET,
      token: FAKE_JWT,
      secret: FAKE_WEBHOOK_SECRET,
      key: FAKE_GOOGLE_KEY,
      apiKey: FAKE_GOOGLE_KEY,
      api_key: FAKE_GOOGLE_KEY,
      clientSecret: FAKE_KEY_SECRET,
      client_secret: FAKE_KEY_SECRET,
      refreshToken: FAKE_JWT,
      cookie: `session=${FAKE_JWT}`,
      nested: { password: FAKE_KEY_SECRET, accessToken: FAKE_JWT, key: FAKE_GOOGLE_KEY },
    });

    expect(leaked(output())).toEqual([]);
    expect(output()).toContain('[REDACTED]');
  });

  it('logs an AxiosError without its config, request or query string', () => {
    logger.error({ err: buildAxiosError() }, 'Upstream call failed');

    const text = output();
    expect(leaked(text)).toEqual([]);
    expect(text).toContain('Request failed with status code 403');
    expect(text).toContain('ERR_BAD_REQUEST');
    expect(text).toContain('"status":403');
    expect(text).toContain('"method":"GET"');
    expect(text).toContain('"url":"https://maps.googleapis.com/maps/api/geocode/json"');
  });

  it('serializes an error passed as the log object itself', () => {
    logger.error(buildAxiosError(), 'Upstream call failed');

    const text = output();
    expect(leaked(text)).toEqual([]);
    expect(text).toContain('Request failed with status code 403');
    expect(text).toContain('"status":403');
    expect(text).toContain('"url":"https://maps.googleapis.com/maps/api/geocode/json"');
  });

  it('serializes an error logged under the error key', () => {
    logger.error({ error: buildAxiosError() }, 'Upstream call failed');

    const text = output();
    expect(leaked(text)).toEqual([]);
    expect(text).toContain('Request failed with status code 403');
    expect(text).toContain('"status":403');
    expect(text).toContain('"url":"https://maps.googleapis.com/maps/api/geocode/json"');
  });

  it('keeps an error cause but strips its secrets', () => {
    const wrapper = new Error('wrapper', { cause: buildAxiosError() });

    logger.error({ err: wrapper }, 'Wrapped failure');

    expect(leaked(output())).toEqual([]);
    expect(output()).toContain('Request failed with status code 403');
  });

  it('keeps the geocoding key out of the log when the request fails', async () => {
    mockEnv.GEOCODING_API_KEY = FAKE_GOOGLE_KEY;
    jest.spyOn(axios, 'get').mockRejectedValueOnce(buildAxiosError());

    const result = await getLatitudeLongitudeFromAddress('somewhere');

    expect(result.formattedAddress).toBe('Unknown');
    expect(output()).toContain('Geocoding request failed');
    expect(leaked(output())).toEqual([]);
  });

  it('does not expose channel or webhook secrets in tool responses', () => {
    const app = formatAppResponse({
      id: 'app-1',
      channel_credentials: [
        { channel: 'TELEGRAM', telegram_credentials: { token: FAKE_CHANNEL_TOKEN } },
        { channel: 'MESSENGER', static_token: { token: FAKE_CHANNEL_TOKEN } },
      ],
    });
    const webhook = formatWebhook({
      id: 'webhook-1',
      app_id: 'app-1',
      target: 'https://example.com/hook',
      target_type: 'HTTP',
      triggers: ['MESSAGE_INBOUND'],
      secret: FAKE_WEBHOOK_SECRET,
    });

    logger.info({ app, webhook }, 'Formatted tool responses');

    expect(leaked(JSON.stringify({ app, webhook }))).toEqual([]);
    expect(leaked(output())).toEqual([]);
  });
});
