import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Voice } from '@sinch/sdk-core';
import { z } from 'zod';
import { getVoiceService } from './utils/voice-service-helper';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse } from '../../types';

export const registerTtsCallout = (server: McpServer) => {
  server.tool(
    'tts-callout',
    'Make a callout with a Text-To-Speech prompt',
    {
      phoneNumber: z.string().describe('The phone number to call'),
      message: z.string().describe('The message to read out loud')
    },
    ttsCalloutHandler
  );
};

export const ttsCalloutHandler = async ({
  phoneNumber,
  message
}: {
  phoneNumber: string;
  message: string;
}): Promise<IPromptResponse> => {
  const maybeClient = getVoiceService();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const voiceService = maybeClient.voice;

  const cli = process.env.CALLING_LINE_IDENTIFICATION;

  const request: Voice.TtsCalloutRequestData = {
    ttsCalloutRequestBody: {
      method: 'ttsCallout',
      ttsCallout: {
        destination: {
          type: 'number',
          endpoint: phoneNumber
        },
        text: message
      }
    }
  };
  if(cli) {
    request.ttsCalloutRequestBody.ttsCallout.cli = cli;
  }

  const response = await voiceService.callouts.tts(request);

  return new PromptResponse(`Calling ${phoneNumber}... The call ID is ${response.callId}`).promptResponse;
};
