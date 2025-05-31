import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVoiceService } from './utils/voice-service-helper';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse } from '../../types';

export const registerManageConferenceParticipant = (server: McpServer) => {
  server.tool(
    'manage-conference-participant',
    'Manage a conference participant. The conference is identified by the conference Id used in the callout, and the participants by the callId associated to their phone number when the conference callout to their number was made',
    {
      conferenceId: z.string().describe('The conference ID used in the callout to create the conference'),
      participantId: z.string().describe('The participant ID, which is the call ID from the conference callout'),
      action: z.enum(['mute', 'unmute', 'onhold', 'resume']).describe('The action to perform on the participant')
    },
    manageConferenceParticipantHandler);
};

export const manageConferenceParticipantHandler = async ({
  conferenceId,
  participantId,
  action
}: {
  conferenceId: string;
  participantId: string;
  action: 'mute' | 'unmute' | 'onhold' | 'resume';
}): Promise<IPromptResponse> => {
  const maybeVoiceService = getVoiceService();
  if (isPromptResponse(maybeVoiceService)) {
    return maybeVoiceService.promptResponse;
  }
  const voiceService = maybeVoiceService;

  await voiceService.conferences.manageParticipant({
    conferenceId,
    callId: participantId,
    manageParticipantRequestBody: {
      command: action
    }
  });

  let result;
  if (action === 'mute') {
    result = `The participant [add here the association with the phone number] (${participantId}) has been muted`;
  } else if (action === 'unmute') {
    result = `The participant [add here the association with the phone number] (${participantId}) has been unmuted`;
  } else if (action === 'onhold') {
    result = `The participant [add here the association with the phone number] (${participantId}) has been put on hold`;
  } else if (action === 'resume') {
    result = `The participant [add here the association with the phone number] (${participantId}) has been brought back in the call`;
  } else {
    result = `The action ${action} is not supported: you need to use "mute", "unmute", "onhold" or "resume"`;
  }

  return new PromptResponse(result).promptResponse;
};
