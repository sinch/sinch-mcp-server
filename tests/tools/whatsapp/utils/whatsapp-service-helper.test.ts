import { getWhatsAppProvisioningClient } from '../../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import { WhatsAppProvisioningClient } from '../../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../../src/types';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

describe('getWhatsAppProvisioningClient', () => {
  const TOOL_NAME = 'create-whatsapp-template';

  beforeEach(() => {
    resetMockEnv();
    mockEnv.PROJECT_ID = 'test-project';
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  test('returns a configured WhatsAppProvisioningClient when credentials are present', () => {
    const client = getWhatsAppProvisioningClient(TOOL_NAME);

    expect(client).toBeInstanceOf(WhatsAppProvisioningClient);
  });

  test('returns a prompt response when credentials are missing', () => {
    mockEnv.PROJECT_ID = undefined;

    const result = getWhatsAppProvisioningClient(TOOL_NAME);

    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse.content[0].text).toContain(
      'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
    );
  });
});
