import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { HttpStatus } from '../../http-status';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RcsSenderId } from './prompt-schemas';
import { formatRcsSender } from './utils/format-rcs-sender-response';
import { getMissingLaunchRequirements } from './utils/launch-requirements';
import { runRcsHandler } from './utils/rcs-handler-helper';
import { RcsApiError } from './utils/rcs-provisioning-client';
import { getToolName, RcsToolKey, toolsConfig } from './utils/rcs-tools-helper';

const LaunchRcsSenderSchema = {
  senderId: RcsSenderId,
};

type LaunchRcsSender = z.infer<z.ZodObject<typeof LaunchRcsSenderSchema>>;

const TOOL_KEY: RcsToolKey = 'launchRcsSender';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerLaunchRcsSender = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Submit an RCS sender for Google and carrier review. Before calling this tool, verify ALL of the following are set via update-rcs-sender — the launch is rejected if any item is missing: (1) details.brand.name; (2) details.brand.logoUrl (JPEG/PNG, max 50 KB, 224×224 px); (3) details.brand.bannerUrl (JPEG/PNG, max 200 KB, 1440×448 px); (4) details.brand.privacyPolicyUrl; (5) details.brand.termsOfServiceUrl; (6) at least one of details.brand.phones or details.brand.emails; (7) details.countries with at least one supported country code; (8) details.questionnaire.general.answers — all fields; (9) details.questionnaire.verification.answers — all fields; (10) country-specific questionnaire section for each country in details.countries (e.g. questionnaire.gb for GB, questionnaire.us for US, questionnaire.fr for FR). Use get-rcs-sender to review current values before launching. If the launch is rejected, the response lists exactly which required details are still missing so they can be filled in and the launch retried.',
      inputSchema: LaunchRcsSenderSchema,
    },
    launchRcsSenderHandler,
  );
};

export const launchRcsSenderHandler = async ({ senderId }: LaunchRcsSender): Promise<IPromptResponse> =>
  runRcsHandler(TOOL_NAME, async (client) => {
    try {
      const sender = await client.launchSender(senderId);

      return new PromptResponse(
        JSON.stringify({
          success: true,
          sender: formatRcsSender(sender),
        }),
      ).promptResponse;
    } catch (error) {
      // A precondition failure means launch requirements are unmet. Return which
      // fields are still missing plus the current sender, not the HTTP status.
      if (error instanceof RcsApiError && error.status === HttpStatus.PRECONDITION_FAILED) {
        const sender = await client.getSender(senderId);
        const missingRequirements = getMissingLaunchRequirements(sender);

        const MISSING_REQUIREMENTS_ERROR =
          'The sender is not ready to launch: some required details are still missing. Fill the items in missingRequirements via update-rcs-sender, then retry the launch.';

        const UNKNOWN_PRECONDITION_ERROR =
          'The launch was rejected but all known requirements appear to be filled. The API may be enforcing a rule not covered by this check (e.g. a field format or value constraint). Review the sender details carefully and contact Sinch support if the issue persists.';

        let errorMessage: string = UNKNOWN_PRECONDITION_ERROR;
        if (missingRequirements.length > 0) {
          errorMessage = MISSING_REQUIREMENTS_ERROR;
        }

        return new PromptResponse(
          JSON.stringify({
            success: false,
            error: errorMessage,
            missingRequirements,
            sender: formatRcsSender(sender),
          }),
        ).promptResponse;
      }
      throw error;
    }
  });
