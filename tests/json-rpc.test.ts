import { buildJsonRpcErrorResponse, getJsonRpcResponseId } from '../src/json-rpc';

describe('json-rpc', () => {
  describe('getJsonRpcResponseId', () => {
    it('returns the request id when present', () => {
      expect(getJsonRpcResponseId({ jsonrpc: '2.0', method: 'initialize', id: 1 })).toBe(1);
      expect(getJsonRpcResponseId({ jsonrpc: '2.0', method: 'initialize', id: 'req-1' })).toBe(
        'req-1',
      );
    });

    it('returns null for notifications, batch requests, and unparsed bodies', () => {
      expect(getJsonRpcResponseId({ jsonrpc: '2.0', method: 'notify' })).toBeNull();
      expect(getJsonRpcResponseId([{ jsonrpc: '2.0', method: 'initialize', id: 1 }])).toBeNull();
      expect(getJsonRpcResponseId(undefined)).toBeNull();
      expect(getJsonRpcResponseId({ jsonrpc: '2.0', method: 'initialize', id: {} })).toBeNull();
    });
  });

  describe('buildJsonRpcErrorResponse', () => {
    it('echoes the parsed request id in error responses', () => {
      expect(
        buildJsonRpcErrorResponse(-32603, 'Internal server error', {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 42,
        }),
      ).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: 42,
      });
    });
  });
});
