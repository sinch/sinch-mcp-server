import { loadAgentM2MCredentials, setAgentSecretManagerClientForTests } from '../../src/auth/agent-secret-manager';

const encodeCredentials = (value: string): string => Buffer.from(value).toString('base64');

describe('agent-secret-manager', () => {
  const getProjectId = jest.fn<Promise<string>, []>();
  const accessSecretVersion = jest.fn();

  beforeEach(() => {
    getProjectId.mockReset().mockResolvedValue('google-project');
    accessSecretVersion.mockReset();
    setAgentSecretManagerClientForTests({ getProjectId, accessSecretVersion });
  });

  afterAll(() => {
    setAgentSecretManagerClientForTests(undefined);
  });

  it('loads the latest secret version using Application Default Credentials project discovery', async () => {
    accessSecretVersion.mockResolvedValue([
      { payload: { data: Buffer.from(encodeCredentials('project-1:key-id:key-secret')) } },
    ]);

    const credentials = await loadAgentM2MCredentials('order-42', 'project-1');

    expect(accessSecretVersion).toHaveBeenCalledWith(
      {
        name: 'projects/google-project/secrets/sinch-agent-m2m_order-42_project-1/versions/latest',
      },
      { timeout: 3_000 },
    );
    expect(credentials).toMatchObject({
      projectId: 'project-1',
      keyId: 'key-id',
      keySecret: 'key-secret',
    });
  });

  it('accepts a string payload returned by the client', async () => {
    accessSecretVersion.mockResolvedValue([{ payload: { data: encodeCredentials('project-1:key-id:key-secret') } }]);

    await expect(loadAgentM2MCredentials('order-42', 'project-1')).resolves.toMatchObject({
      projectId: 'project-1',
    });
  });

  it.each([
    ['missing payload', {}],
    ['empty payload', { payload: {} }],
    ['malformed payload', { payload: { data: Buffer.from('not-base64!!') } }],
    [
      'credentials for another project',
      { payload: { data: Buffer.from(encodeCredentials('other-project:key-id:key-secret')) } },
    ],
  ])('fails closed for %s', async (_label, version) => {
    accessSecretVersion.mockResolvedValue([version]);

    await expect(loadAgentM2MCredentials('order-42', 'project-1')).resolves.toBeUndefined();
  });

  it.each([
    ['project discovery failure', () => getProjectId.mockRejectedValue(new Error('ADC unavailable'))],
    [
      'secret access failure',
      () => accessSecretVersion.mockRejectedValue(Object.assign(new Error('denied'), { code: 7 })),
    ],
  ])('fails closed on %s', async (_label, arrange) => {
    arrange();

    await expect(loadAgentM2MCredentials('order-42', 'project-1')).resolves.toBeUndefined();
  });

  it('rejects invalid identifiers without calling Google', async () => {
    await expect(loadAgentM2MCredentials('order_with_separator', 'project-1')).resolves.toBeUndefined();

    expect(getProjectId).not.toHaveBeenCalled();
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });
});
