import { buildTtsCallRequest } from '../../../../../src/tools/voice/utils/builders/tts-call-builder';

test('buildTtsCallRequest builds the complete TTS call flow', () => {
  expect(
    buildTtsCallRequest({
      from: '+14045001000',
      to: '+14155550123',
      message: '<speak>Hello from Sinch.</speak>',
      voiceName: 'Amy',
      format: 'SSML',
      serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
      dialTimeoutDurationSeconds: 20,
      maxCallDurationSeconds: 60,
    }),
  ).toEqual({
    serviceId: '6e124178-c29d-46a5-943c-5c2ae544aade',
    createCallRequestBody: {
      commands: [
        {
          command: 'dial',
          callName: 'tts-callout',
          from: {
            type: 'PHONE',
            phone: { number: '+14045001000' },
          },
          to: {
            type: 'PHONE',
            phone: { number: '+14155550123' },
          },
          dialTimeoutDurationSeconds: 20,
          maxCallDurationSeconds: 60,
          events: {
            onAnswer: [
              {
                command: 'messages',
                messagesName: 'tts-message',
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
                events: {
                  onFinish: [{ command: 'hangup' }],
                },
              },
            ],
            onBusy: [{ command: 'hangup' }],
            onReject: [{ command: 'hangup' }],
            onTimeout: [{ command: 'hangup' }],
            onFailure: [{ command: 'hangup' }],
          },
        },
      ],
    },
  });
});
