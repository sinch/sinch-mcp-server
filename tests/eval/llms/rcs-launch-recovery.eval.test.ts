import { defineWorkflowEval } from './utils/workflow-eval-harness';

const AGENT_NAME = 'SergioTestCorp';

// Ambiguity / error-recovery eval: launch too early → the model must surface
// the missing requirements (not claim success) → the user provides them → the
// model updates and relaunches. `enforceLaunch` makes the mock return 412 until
// the sender is complete, so the real handler's missing-requirements logic runs.
defineWorkflowEval({
  name: 'RCS launch recovery',
  enforceLaunch: true,
  // Recovery is harder/more variable than happy-path routing. This is a
  // conservative starting threshold — calibrate it from a full 30-iteration run.
  passRate: 0.7,
  steps: [
    {
      id: 'create-sender',
      prompt: `Create a new RCS agent named '${AGENT_NAME}' in the US region, with a TRANSACTIONAL use case and a conversational billing category.`,
      accept: ['create-rcs-sender'],
    },
    {
      // The model should surface the unmet launch requirements — whether it
      // refuses up front (from the tool description) or attempts launch and
      // relays the 412 — rather than claim success.
      id: 'premature-launch',
      prompt: `Great, launch the ${AGENT_NAME} sender now.`,
      responseIncludes: ['privacy'],
    },
    {
      id: 'provide-missing',
      prompt: `Update the ${AGENT_NAME} sender with everything needed to launch: brand logo URL https://cdn.example.com/logo.png, banner URL https://cdn.example.com/banner.png, privacy policy URL https://example.com/privacy, terms of service URL https://example.com/terms, a support email support@example.com, and set the target country to the US. The general and verification questionnaire sections are already complete. Do not launch it yet.`,
      accept: ['update-rcs-sender'],
    },
    {
      id: 'relaunch',
      prompt: `Everything is set now — launch the ${AGENT_NAME} sender.`,
      accept: ['launch-rcs-sender'],
    },
  ],
});
