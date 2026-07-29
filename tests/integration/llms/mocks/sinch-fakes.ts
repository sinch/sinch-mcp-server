import { AsyncLocalStorage } from 'node:async_hooks';
import { jest } from '@jest/globals';
import { RcsApiError } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';

// Scopes the fake RCS sender store per eval iteration. Eval suites run several
// iterations concurrently against the same mocked module (see
// tests/eval/llms/utils/workflow-eval-harness.ts, `withIsolatedSinchState`), so
// a single shared Map would let one iteration's senders leak into another's
// `listSenders`/`getSender` calls. Integration suites run a single sequential
// workflow and never enter this context, so they fall back to one shared map.
const sendersContext = new AsyncLocalStorage<Map<string, any>>();
const sharedSenders = new Map<string, any>();
const currentSenders = (): Map<string, any> => sendersContext.getStore() ?? sharedSenders;

// Same isolation need as the RCS senders above, for the fake WhatsApp template store.
const templatesContext = new AsyncLocalStorage<Map<string, any>>();
const sharedTemplates = new Map<string, any>();
const currentTemplates = (): Map<string, any> => templatesContext.getStore() ?? sharedTemplates;
const templateKey = (name: string, language: string): string => `${name}::${language}`;

/** Runs `fn` with its own isolated RCS sender + WhatsApp template store — use per eval iteration. */
export const withIsolatedSinchState = <T>(fn: () => Promise<T>): Promise<T> =>
  sendersContext.run(new Map(), () => templatesContext.run(new Map(), fn));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Mirrors real PATCH semantics: nested objects merge key-by-key (so filling
// `questionnaire.general` in one call and `questionnaire.verification` in the
// next doesn't wipe the first), arrays and primitives are replaced wholesale.
const deepMerge = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? deepMerge(merged[key], value) : value;
  }
  return merged;
};

/**
 * Registers in-process fakes for the Sinch service helpers via
 * `jest.unstable_mockModule`, so the real MCP tool handlers run without any real
 * API call. Call this before the server is imported (i.e. at the top of a suite,
 * which the harnesses do). One shared, stateful fake serves every workflow; add
 * a service here when a workflow needs a new one.
 */
export const registerSinchMocks = (opts: { enforceLaunch?: boolean } = {}): void => {
  // RCS provisioning: stateful fake (create → id → reuse across turns).
  let seq = 0;
  const rcs = {
    createSender: async (body: any) => {
      const senders = currentSenders();
      const id = `snd_${++seq}`;
      const sender = { id, state: 'DRAFT', authName: `${id}-auth`, authToken: 'fake-token', ...body };
      senders.set(id, sender);
      return sender;
    },
    getSender: async (id: string) => currentSenders().get(id) ?? { id, state: 'DRAFT' },
    listSenders: async () => {
      const senders = currentSenders();
      return { senders: [...senders.values()], totalSize: senders.size };
    },
    updateSender: async (id: string, body: any) => {
      const senders = currentSenders();
      const sender = senders.get(id) ?? { id, state: 'IN_PROGRESS', details: {} };
      sender.details = deepMerge(sender.details ?? {}, body?.details ?? {});
      sender.state = 'IN_PROGRESS';
      senders.set(id, sender);
      return sender;
    },
    addTestNumbers: async (_id: string, testNumbers: string[]) => ({
      testNumbers: testNumbers.map((number) => ({ number, state: 'PENDING' })),
    }),
    launchSender: async (id: string) => {
      const senders = currentSenders();
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

  // Conversation API: enough for set-sms-channel-on-app / update-conversation-app
  // (get + update), delete-conversation-app, and send-text-message.
  const conversation = {
    app: {
      list: async () => ({ apps: [] }),
      get: async ({ app_id }: { app_id: string }) => ({
        id: app_id,
        display_name: 'Mock App',
        channel_credentials: [{ channel: 'SMS' }, { channel: 'WHATSAPP' }],
      }),
      update: async ({ app_id, appUpdateRequestBody }: any) => ({
        id: app_id,
        display_name: appUpdateRequestBody?.display_name ?? 'Mock App',
        channel_credentials: appUpdateRequestBody?.channel_credentials ?? [{ channel: 'SMS' }],
      }),
      delete: async ({ app_id }: { app_id: string }) => ({ deleted: true, app_id }),
    },
    messages: {
      sendTextMessage: async () => ({ message_id: 'msg_mock_1' }),
      sendTemplateMessage: async () => ({ message_id: 'msg_mock_whatsapp_1' }),
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

  // WhatsApp template management: stateful fake (create → name/language key → reuse across turns).
  const whatsapp = {
    listTemplates: async () => {
      const templates = [...currentTemplates().values()];
      return { totalSize: templates.length, pageSize: templates.length, templates };
    },
    createTemplate: async (body: any) => {
      const template = {
        name: body.name,
        language: body.language,
        category: body.category,
        analytics: [],
        isMetaGenerated: false,
        state: body.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
        details: body.details,
      };
      currentTemplates().set(templateKey(body.name, body.language), template);
      return template;
    },
    updateTemplate: async (templateName: string, languageCode: string, body: any) => {
      const key = templateKey(templateName, languageCode);
      const existing = currentTemplates().get(key) ?? {
        name: templateName,
        language: languageCode,
        category: 'UTILITY',
        analytics: [],
        isMetaGenerated: false,
        state: 'DRAFT',
      };
      const updated = {
        ...existing,
        ...body,
        state: body.status === 'SUBMIT' ? 'PENDING' : 'DRAFT',
      };
      currentTemplates().set(key, updated);
      return updated;
    },
    deleteTemplate: async (templateName: string, languageCode: string) => {
      currentTemplates().delete(templateKey(templateName, languageCode));
    },
    deleteTemplateByName: async (templateName: string) => {
      for (const key of [...currentTemplates().keys()]) {
        if (key.startsWith(`${templateName}::`)) {
          currentTemplates().delete(key);
        }
      }
    },
  };
  jest.unstable_mockModule('../../../../src/tools/whatsapp/utils/whatsapp-service-helper', () => ({
    getWhatsAppProvisioningClient: () => whatsapp,
  }));
};
