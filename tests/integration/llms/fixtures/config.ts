export const TEMPERATURE = 0; //no variability for testing
// Allow headroom for tool execution on top of the LLM call.
export const TIMEOUT = 45000;

// Default models, provider/model form.
export const DEFAULT_ANTHROPIC_MODEL = 'anthropic/claude-3-7-sonnet-latest';
export const DEFAULT_OPENAI_MODEL = 'openai/gpt-5-mini';
export const DEFAULT_GEMINI_MODEL = 'google/gemini-3.1-pro';

// Default model for the multi-turn workflow suites. Override via WORKFLOW_MODEL.
export const DEFAULT_WORKFLOW_MODEL = 'openai/gpt-5-mini';

// gpt-5-mini, gpt-5-nano, gpt-5.6-terra, gpt-5.6-luna
// gemini-3.1-pro, gemini-3.5-flash, gemini-2.5-pro
