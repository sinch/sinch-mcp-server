import type { Voice } from '@sinch/voice';
import type { TtsFormat } from './tts-call-builder';

export interface BuildTtsBatchRequest {
  from?: string;
  destinations: string[];
  message: string;
  voiceName: string;
  format: TtsFormat;
  serviceId?: string;
  dialTimeoutDurationSeconds: number;
  maxCallDurationSeconds: number;
  maxCps?: number;
  ttlSeconds?: number;
}

export const buildTtsBatchRequest = ({
  from,
  destinations,
  message,
  voiceName,
  format,
  serviceId,
  dialTimeoutDurationSeconds,
  maxCallDurationSeconds,
  maxCps,
  ttlSeconds,
}: BuildTtsBatchRequest): Voice.v2.StartBatchRequestData => ({
  ...(serviceId !== undefined ? { serviceId } : {}),
  startBatchRequestBody: {
    commands: [
      {
        command: 'dial',
        ...(from !== undefined
          ? {
              from: {
                type: 'PHONE' as const,
                phone: { number: '@from' },
              },
            }
          : {}),
        to: {
          type: 'PHONE',
          phone: { number: '@to' },
        },
        dialTimeoutDurationSeconds,
        maxCallDurationSeconds,
        events: {
          onAnswer: [
            {
              command: 'messages',
              messagesName: 'tts-batch-message',
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
    parameters: destinations.map((to) => ({
      ...(from !== undefined ? { from } : {}),
      to,
    })),
    ...(maxCps !== undefined || ttlSeconds !== undefined
      ? {
          batchOptions: {
            ...(maxCps !== undefined ? { maxCps } : {}),
            ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
          },
        }
      : {}),
  },
});
