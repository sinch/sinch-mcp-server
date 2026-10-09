import { buildTtsBatchRequest } from '../../../../../src/tools/voice/utils/builders/tts-batch-builder';

test('buildTtsBatchRequest uses documented placeholders and one parameter set per destination', () => {
  const request = buildTtsBatchRequest({
    from: '+14045001000',
    destinations: ['+14155550123', '+14155550124'],
    message: '<speak>Hello from Sinch.</speak>',
    voiceName: 'Amy',
    format: 'SSML',
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    dialTimeoutDurationSeconds: 20,
    maxCallDurationSeconds: 60,
    maxCps: 25,
    ttlSeconds: 600,
  });

  expect(request).not.toHaveProperty('Idempotency-Key');
  expect(request.serviceId).toBe('6e124178-c29d-46a5-943c-5c2ae544aade');
  expect(request.startBatchRequestBody?.parameters).toEqual([
    { from: '+14045001000', to: '+14155550123' },
    { from: '+14045001000', to: '+14155550124' },
  ]);
  expect(request.startBatchRequestBody?.batchOptions).toEqual({
    maxCps: 25,
    ttlSeconds: 600,
  });
  expect(request.startBatchRequestBody?.commands).toEqual([
    {
      command: 'dial',
      from: {
        type: 'PHONE',
        phone: { number: '@from' },
      },
      to: {
        type: 'PHONE',
        phone: { number: '@to' },
      },
      dialTimeoutDurationSeconds: 20,
      maxCallDurationSeconds: 60,
      events: expect.objectContaining({
        onAnswer: [
          expect.objectContaining({
            command: 'messages',
            messages: [
              {
                type: 'SAY',
                say: {
                  text: '<speak>Hello from Sinch.</speak>',
                  voiceName: 'Amy',
                  format: 'SSML',
                },
              },
            ],
          }),
        ],
      }),
    },
  ]);
});

test('buildTtsBatchRequest omits batch options when none are supplied', () => {
  const request = buildTtsBatchRequest({
    from: '+14045001000',
    destinations: ['+14155550123'],
    message: 'Hello',
    voiceName: 'Emma',
    format: 'TEXT',
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    dialTimeoutDurationSeconds: 30,
    maxCallDurationSeconds: 300,
  });

  expect(request.startBatchRequestBody).not.toHaveProperty('batchOptions');
});
