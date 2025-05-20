import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SinchClient } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVerificationCredentials } from '../verification/credentials.js';

export const registerManageConferenceParticipant = (server: McpServer) => {
  server.tool('manage-conference-participant', 'Manage a conference participant. The conference is identified by the conference Id used in the callout, and the participants by the callId associated to their phone number when the conference callout to their number was made', {
    conferenceId: z.string().describe('The conference ID used in the callout to create the conference'),
    participantId: z.string().describe('The participant ID, which is the call ID from the conference callout'),
    action: z.enum(['mute', 'unmute', 'onhold', 'resume']).describe('The action to perform on the participant'),
    sessionId: z.string().optional().describe('Optional session ID to track the user')
  },
  async ({ conferenceId, participantId, action, sessionId }) => {

    const credentials = await getVerificationCredentials(sessionId);
    if ('promptResponse' in credentials) {
      console.error(`No verification credentials found for the session ${credentials.sessionId}`);
      return credentials.promptResponse;
    }

    const sinchClient = new SinchClient({
      applicationKey: credentials.appId,
      applicationSecret: credentials.appSecret
    });

    await sinchClient.voice.conferences.manageParticipant({
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

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };

  });
};
