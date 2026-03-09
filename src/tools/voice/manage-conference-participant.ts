import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getVoiceClient } from './utils/voice-service-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: VoiceToolKey = 'manageConferenceParticipant';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerManageConferenceParticipant = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
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
  const maybeClient = getVoiceClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const voiceService = maybeClient.voice;

  try {
    await voiceService.conferences.manageParticipant({
      conferenceId,
      callId: participantId,
      manageParticipantRequestBody: {
        command: action
      }
    });

    return new PromptResponse(JSON.stringify({
      success: true,
      conference_id: conferenceId,
      participant_id: participantId,
      action: action
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
};
