export const getJsonRpcResponseId = (body: unknown): string | number | null => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  if (!('id' in body)) {
    return null;
  }

  const { id } = body as { id?: unknown };
  if (id === null) {
    return null;
  }

  if (typeof id === 'string' || typeof id === 'number') {
    return id;
  }

  return null;
};

export const buildJsonRpcErrorResponse = (
  code: number,
  message: string,
  body: unknown,
): {
  jsonrpc: '2.0';
  error: { code: number; message: string };
  id: string | number | null;
} => ({
  jsonrpc: '2.0',
  error: { code, message },
  id: getJsonRpcResponseId(body),
});
