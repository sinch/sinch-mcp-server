import { RcsProvisioningClient } from '../../../../src/tools/rcs/utils/rcs-provisioning-client';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }));
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

test('launchSender surfaces additionalInformation.validationErrors on the thrown error', async () => {
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          errorCode: 'launch_precondition_failed',
          message: 'Launch precondition failed.',
          additionalInformation: { validationErrors: ['details.countries must contain at least 1 elements'] },
        }),
        { status: 412, statusText: 'Precondition Failed' },
      ),
  );

  await expect(client.launchSender('s1')).rejects.toMatchObject({
    status: 412,
    errorCode: 'launch_precondition_failed',
    validationErrors: ['details.countries must contain at least 1 elements'],
  });
});
