/**
 * Map of the tools' status: the key is the tool's name, and the value is its status.
 * If the tool is not filtered out and its credentials are defined, its description should be ENABLED.
 * If the tool is filtered out or its credentials are not defined, its description should be a reason why it is disabled.
 */
export const toolsStatusMap: Record<string, string> = {};

/** The tool is not filtered out and its credentials are defined => its description should be ENABLED */
export const ENABLED = 'enabled';
