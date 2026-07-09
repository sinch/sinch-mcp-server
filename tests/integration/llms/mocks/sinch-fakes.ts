import { jest } from '@jest/globals';
import { RcsApiError } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';

/**
 * Registers in-process fakes for the Sinch service helpers via
 * `jest.unstable_mockModule`, so the real MCP tool handlers run without any real
 * API call. Call this before the server is imported (i.e. at the top of a suite,
 * which the harnesses do). One shared, stateful fake serves every workflow; add
 * a service here when a workflow needs a new one.
 */
export const registerSinchMocks = (opts: { enforceLaunch?: boolean } = {}): void => {
  // RCS provisioning: stateful fake (create → id → reuse across turns).
  const senders = new Map<string, any>();
  let seq = 0;
  const rcs = {
    createSender: async (body: any) => {
      const id = `snd_${++seq}`;
      const sender = { id, state: 'DRAFT', authName: `${id}-auth`, authToken: 'fake-token', ...body };
      senders.set(id, sender);
      return sender;
    },
    getSender: async (id: string) => senders.get(id) ?? { id, state: 'DRAFT' },
    listSenders: async () => ({ senders: [...senders.values()], totalSize: senders.size }),
    updateSender: async (id: string, body: any) => {
      const sender = senders.get(id) ?? { id, state: 'IN_PROGRESS', details: {} };
      sender.details = { ...(sender.details ?? {}), ...(body?.details ?? {}) };
      sender.state = 'IN_PROGRESS';
      senders.set(id, sender);
      return sender;
    },
    addTestNumbers: async (_id: string, testNumbers: string[]) => ({
      testNumbers: testNumbers.map((number) => ({ number, state: 'PENDING' })),
    }),
    launchSender: async (id: string) => {
      const sender = senders.get(id) ?? { id };
      const complete =
        sender.details?.brand?.privacyPolicyUrl &&
        sender.details?.brand?.termsOfServiceUrl &&
        sender.details?.countries?.length;
      if (opts.enforceLaunch && !complete) {
        throw new RcsApiError(412, 'Precondition Failed');
      }
      sender.state = 'LAUNCHING';
      senders.set(id, sender);
      return sender;
    },
  };
  jest.unstable_mockModule('../../../../src/tools/rcs/utils/rcs-service-helper', () => ({
    getRcsProvisioningClient: () => rcs,
  }));

  // Conversation API: enough for set-sms-channel-on-app (get app, then update).
  const conversation = {
    app: {
      list: async () => ({ apps: [] }),
      get: async ({ app_id }: { app_id: string }) => ({
        id: app_id,
        display_name: 'Mock App',
        channel_credentials: [],
      }),
      update: async ({ app_id, appUpdateRequestBody }: any) => ({
        id: app_id,
        display_name: 'Mock App',
        channel_credentials: appUpdateRequestBody?.channel_credentials ?? [{ channel: 'SMS' }],
      }),
    },
  };
  // Must mirror ALL exports of the real module — a whole-module mock replaces it,
  // and any tool importing a missing export would fail to load.
  jest.unstable_mockModule('../../../../src/tools/conversation/utils/conversation-service-helper', () => ({
    getConversationService: () => conversation,
    setConversationRegion: () => 'us',
    setTemplateRegion: () => 'us',
    getConversationAppId: (appId?: string) => appId ?? 'app_mock',
  }));
};
