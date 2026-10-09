import { RcsProvisioningClient } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 's1' }) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

const client = new RcsProvisioningClient('proj', 'key', 'secret', 'update-rcs-sender');

const calledUrl = () => fetchMock.mock.calls[0][0] as string;

test('updateSender sends usQuestionnaireVersion=v2 when the body has a US questionnaire', async () => {
  await client.updateSender('s1', { details: { questionnaire: { us: { answers: { brandName: 'Acme' } } } } });

  expect(calledUrl()).toEndWith('/rcs/senders/s1?usQuestionnaireVersion=v2');
});

test('updateSender omits the query param when the body has no US questionnaire', async () => {
  await client.updateSender('s1', { details: { questionnaire: { gb: { answers: {} } } } });
  await client.updateSender('s1', { details: { brand: { name: 'Acme' } } });

  expect(fetchMock.mock.calls.map(([url]) => url)).toSatisfyAll((url: string) => url.endsWith('/rcs/senders/s1'));
});
