import process from 'process';
import { version as mcpServerVersion } from '../package.json';

export const USER_AGENT = `sinch-sdk/${mcpServerVersion} (MCP/${process.version}; default; none)`
