import { loadAgentM2MCredentials, setAgentSecretManagerClientForTests } from '../../src/auth/agent-secret-manager';

const encodeCredentials = (value: string): string => Buffer.from(value).toString('base64');
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

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
      { payload: { data: Buffer.from(encodeCredentials(`${PROJECT_ID}:key-id:key-secret`)) } },
    ]);

    const credentials = await loadAgentM2MCredentials(ORDER_ID, PROJECT_ID);

    expect(accessSecretVersion).toHaveBeenCalledWith(
      {
        name: `projects/google-project/secrets/sinch-agent-m2m_${ORDER_ID}_${PROJECT_ID}/versions/latest`,
      },
      { timeout: 3_000 },
    );
    expect(credentials).toMatchObject({
      projectId: PROJECT_ID,
      keyId: 'key-id',
      keySecret: 'key-secret',
    });
  });

  it('accepts a string payload and compares UUIDs case-insensitively', async () => {
    accessSecretVersion.mockResolvedValue([
      { payload: { data: encodeCredentials(`${PROJECT_ID}:key-id:key-secret`) } },
    ]);

    await expect(loadAgentM2MCredentials(ORDER_ID.toUpperCase(), PROJECT_ID.toUpperCase())).resolves.toMatchObject({
      projectId: PROJECT_ID,
    });
  });

  it.each([
    ['missing payload', {}],
    ['empty payload', { payload: {} }],
    ['malformed payload', { payload: { data: Buffer.from('not-base64!!') } }],
    [
      'credentials for another project',
      {
        payload: {
          data: Buffer.from(encodeCredentials('33333333-3333-4333-8333-333333333333:key-id:key-secret')),
        },
      },
    ],
  ])('fails closed for %s', async (_label, version) => {
    accessSecretVersion.mockResolvedValue([version]);

    await expect(loadAgentM2MCredentials(ORDER_ID, PROJECT_ID)).resolves.toBeUndefined();
  });

  it.each([
    ['project discovery failure', () => getProjectId.mockRejectedValue(new Error('ADC unavailable'))],
    [
      'secret access failure',
      () => accessSecretVersion.mockRejectedValue(Object.assign(new Error('denied'), { code: 7 })),
    ],
  ])('fails closed on %s', async (_label, arrange) => {
    arrange();

    await expect(loadAgentM2MCredentials(ORDER_ID, PROJECT_ID)).resolves.toBeUndefined();
  });

  it('rejects invalid identifiers without calling Google', async () => {
    await expect(loadAgentM2MCredentials('not-a-uuid', PROJECT_ID)).resolves.toBeUndefined();

    expect(getProjectId).not.toHaveBeenCalled();
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });
});
