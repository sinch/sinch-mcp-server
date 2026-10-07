import { SinchClient } from '@sinch/sdk-core';
import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';

export interface VoiceV2Client {
  projectId: string;
  voice: SinchClient['voice']['v2'];
  numbers: SinchClient['numbers'];
}

export const getVoiceV2Client = (): VoiceV2Client | PromptResponse => {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials;
  }

  const client = new SinchClient({
    projectId: maybeCredentials.projectId,
    keyId: maybeCredentials.keyId,
    keySecret: maybeCredentials.keySecret,
  });

  return {
    projectId: maybeCredentials.projectId,
    voice: client.voice.v2,
    numbers: client.numbers,
  };
};
