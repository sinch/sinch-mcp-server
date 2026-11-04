import { AsyncLocalStorage } from 'node:async_hooks';
import type { ApiFetchClient, FileBuffer, FileData, PageResult } from '@sinch/sdk-client';
import { HttpStatus } from '../http-status';
import { getToolMetrics } from './metrics';

export const SINCH_API_TIMEOUT_MS = 60_000;

export type SinchApiName = 'conversation' | 'numbers' | 'voice' | 'verification' | 'number_lookup' | 'provisioning';

export type SinchApiOutcome = 'ok' | 'client_error' | 'server_error' | 'timeout' | 'network_error';

type ApiCallParameters = Parameters<ApiFetchClient['processCall']>[0];
type ApiCallParametersWithPagination = Parameters<ApiFetchClient['processCallWithPagination']>[0];

type ResponsePlugin = NonNullable<ApiFetchClient['apiClientOptions']['responsePlugins']>[number];

type TimedMethod = 'processCall' | 'processCallWithPagination' | 'processFileCall' | 'processCsvCall';

// The SDK returns only the parsed body, so a response plugin hands the exact status back to the timed call.
const callStatus = new AsyncLocalStorage<{ statusCode?: number }>();

const statusCapturePlugin: ResponsePlugin = {
  load: (context) => ({
    transform: (data) => {
      const store = callStatus.getStore();
      if (store && typeof context.response?.status === 'number') {
        store.statusCode = context.response.status;
      }
      return data;
    },
  }),
};

// Transport timeouts surface from the SDK as `[Empty response] <node-fetch message>`; anchoring on that marker
// keeps an operationId or URL containing "timeout" from matching.
const SDK_TIMEOUT_MESSAGE_PATTERN = /\[Empty response\] (?:network timeout at:|Response timeout while trying to fetch)/;

const isTimeoutError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { name, message } = error as { name?: unknown; message?: unknown };
  return name === 'TimeoutError' || (typeof message === 'string' && SDK_TIMEOUT_MESSAGE_PATTERN.test(message));
};

const getStatusCode = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === 'number' ? statusCode : undefined;
};

export const classifySinchApiOutcome = (statusCode: number | undefined, error?: unknown): SinchApiOutcome => {
  if (typeof statusCode === 'number') {
    if (statusCode === HttpStatus.REQUEST_TIMEOUT || statusCode === HttpStatus.GATEWAY_TIMEOUT) {
      return 'timeout';
    }
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'server_error';
    }
    if (statusCode >= HttpStatus.BAD_REQUEST) {
      return 'client_error';
    }
    return 'ok';
  }
  if (error === undefined || error === null) {
    return 'ok';
  }
  return isTimeoutError(error) ? 'timeout' : 'network_error';
};

const recordSinchApiCall = (api: SinchApiName, startedAt: number, statusCode: string, outcome: SinchApiOutcome) => {
  getToolMetrics().sinchApiDurationMs.record(performance.now() - startedAt, {
    api,
    status_code: statusCode,
    outcome,
  });
};

const timeSinchApiCall = async <R>(api: SinchApiName, run: () => Promise<R>): Promise<R> => {
  const startedAt = performance.now();
  const store: { statusCode?: number } = {};
  try {
    const result = await callStatus.run(store, run);
    // File and CSV calls skip response plugins, so no exact status is available for them.
    recordSinchApiCall(api, startedAt, typeof store.statusCode === 'number' ? String(store.statusCode) : '2xx', 'ok');
    return result;
  } catch (error) {
    const statusCode = getStatusCode(error);
    recordSinchApiCall(
      api,
      startedAt,
      typeof statusCode === 'number' ? String(statusCode) : 'none',
      classifySinchApiOutcome(statusCode, error),
    );
    throw error;
  }
};

export const timedSdkFetchClient = <C extends Pick<ApiFetchClient, TimedMethod | 'apiClientOptions'>>(
  client: C,
  api: SinchApiName,
): C => {
  client.apiClientOptions.responsePlugins = [statusCapturePlugin, ...(client.apiClientOptions.responsePlugins ?? [])];
  const { processCall, processCallWithPagination, processFileCall, processCsvCall } = client;

  client.processCall = <T>(params: ApiCallParameters) =>
    timeSinchApiCall(api, () => processCall.call<C, [ApiCallParameters], Promise<T>>(client, params));
  client.processCallWithPagination = <T>(params: ApiCallParametersWithPagination) =>
    timeSinchApiCall(api, () =>
      processCallWithPagination.call<C, [ApiCallParametersWithPagination], Promise<PageResult<T>>>(client, params),
    );
  client.processFileCall = (params: ApiCallParameters) =>
    timeSinchApiCall(api, () => processFileCall.call<C, [ApiCallParameters], Promise<FileBuffer>>(client, params));
  client.processCsvCall = (params: ApiCallParameters) =>
    timeSinchApiCall(api, () => processCsvCall.call<C, [ApiCallParameters], Promise<FileData>>(client, params));
  return client;
};

// Raw REST calls: adds a timeout and records the duration including the body read, which the timeout also covers.
// The body is buffered so the returned Response can't time out later, after the metric was recorded.
export const timedFetchSinchApi = async (
  api: SinchApiName,
  url: string,
  init: Omit<NonNullable<Parameters<typeof fetch>[1]>, 'signal'> = {},
): Promise<Response> => {
  const startedAt = performance.now();
  let statusCode: number | undefined;
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(SINCH_API_TIMEOUT_MS) });
    statusCode = response.status;
    const body = await response.arrayBuffer();
    const buffered = new Response(body.byteLength > 0 ? body : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    recordSinchApiCall(api, startedAt, String(statusCode), classifySinchApiOutcome(statusCode));
    return buffered;
  } catch (error) {
    const outcome = classifySinchApiOutcome(undefined, error);
    recordSinchApiCall(api, startedAt, typeof statusCode === 'number' ? String(statusCode) : 'none', outcome);
    if (outcome === 'timeout') {
      throw new Error(`Sinch ${api} API request timed out after ${SINCH_API_TIMEOUT_MS / 1000}s`, { cause: error });
    }
    throw error;
  }
};
