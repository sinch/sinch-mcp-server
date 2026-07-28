import { toolTestCases, ToolTestCase } from './tool-cases';

/**
 * Tools covered by multi-turn workflow / eval `accept` lists.
 * Keep in sync when adding `accept: [...]` in workflow or eval suites —
 * the coverage gate asserts every live `tools/list` name appears here or in
 * tool-cases (not in hand-maintained all.json).
 */
export const MULTI_TURN_ACCEPT_TOOLS: readonly string[] = [
  'create-rcs-sender',
  'get-rcs-sender',
  'list-rcs-senders',
  'update-rcs-sender',
  'add-rcs-test-number',
  'launch-rcs-sender',
  'set-sms-channel-on-app',
  'send-text-message',
];

export const collectCoveredToolsFromCases = (cases: ToolTestCase[]): Set<string> => {
  const covered = new Set<string>();
  for (const testCase of cases) {
    if (testCase.expectedToolName) {
      covered.add(testCase.expectedToolName);
    }
    for (const name of testCase.accept ?? []) {
      covered.add(name);
    }
  }
  return covered;
};

/** All tool names exercised by LLM fixtures (single-turn + multi-turn accept lists). */
export const collectFixtureCoveredTools = (): Set<string> => {
  const covered = collectCoveredToolsFromCases(toolTestCases);
  for (const name of MULTI_TURN_ACCEPT_TOOLS) {
    covered.add(name);
  }
  return covered;
};
