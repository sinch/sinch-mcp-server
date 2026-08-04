import process from 'node:process';
import pkg from '../package.json';
const mcpServerVersion = pkg.version;

export const USER_AGENT = `sinch-sdk/MCP-${mcpServerVersion} (JavaScript/${process.version}; {toolName}; {userId})`;
