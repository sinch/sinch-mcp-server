import type { Voice } from '@sinch/voice';

export type TtsFormat = 'TEXT' | 'SSML';

export interface BuildTtsCallRequest {
  from: string;
  to: string;
  message: string;
  voiceName: string;
  format: TtsFormat;
  serviceId: string;
  dialTimeoutDurationSeconds: number;
  maxCallDurationSeconds: number;
}

export const buildTtsCallRequest = ({
  from,
  to,
  message,
  voiceName,
  format,
  serviceId,
  dialTimeoutDurationSeconds,
  maxCallDurationSeconds,
}: BuildTtsCallRequest): Voice.v2.CreateCallRequestData => ({
  serviceId,
  createCallRequestBody: {
    commands: [
      {
        command: 'dial',
        callName: 'tts-callout',
        from: {
          type: 'PHONE',
          phone: { number: from },
        },
        to: {
          type: 'PHONE',
          phone: { number: to },
        },
        dialTimeoutDurationSeconds,
        maxCallDurationSeconds,
        events: {
          onAnswer: [
            {
              command: 'messages',
              messagesName: 'tts-message',
              messages: [
                {
                  type: 'SAY',
                  say: {
                    text: message,
                    voiceName,
                    format,
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
