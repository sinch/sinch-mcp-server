import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Voice } from '@sinch/voice';
import { z } from 'zod';
import { getVoiceService } from './utils/voice-service-helper';
import { env } from '../../env';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TtsCalloutSchema = {
  phoneNumber: z.string().describe('The phone number to call'),
  message: z.string().describe('The message to read out loud'),
};

type TtsCallout = z.infer<z.ZodObject<typeof TtsCalloutSchema>>;

const TOOL_KEY: VoiceToolKey = 'ttsCallout';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerTtsCallout = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Make a callout with a Text-To-Speech prompt',
      inputSchema: TtsCalloutSchema,
    },
    ttsCalloutHandler
  );
};

export const ttsCalloutHandler = async ({
  phoneNumber,
  message
}: TtsCallout): Promise<IPromptResponse> => {
  const maybeService = getVoiceService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const voiceService = maybeService;

  const cli = env.CALLING_LINE_IDENTIFICATION;

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

  try {
    const response = await voiceService.callouts.tts(request);

    return new PromptResponse(JSON.stringify({
      success: true,
      call_id: response.callId,
      destination: phoneNumber
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
};
