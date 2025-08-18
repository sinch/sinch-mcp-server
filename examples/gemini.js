/**
npm install @google/genai
export GEMINI_API_KEY= 
 */

// https://github.com/googleapis/js-genai
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import ngrok from '@ngrok/ngrok';

const client = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']
})

  export const openNgrokTunnel = async () => {
  const listener = await ngrok.forward({
    addr: "http://localhost:8000",
    authtoken: process.env.NGROK_AUTH_TOKEN,
  });

  const url = listener.url();
  if (!url) {
    throw new Error('Failed to obtain ngrok URL');
  }
  return url +"/sse";
}

const tunnel = await openNgrokTunnel()

console.log ("tunnel", tunnel)
const serverParams = new SSEClientTransport( new URL( tunnel)
);

console.log ("serverParams", serverParams)

const mcpClient = new Client(
  {
    name: "example-client",
    version: "1.0.0"
  }
);
await mcpClient.connect(serverParams);

const tools = await mcpClient.listTools()

console.log("Discovered tools on MCP client:", tools);
console.log("Discovered tools on MCP client:", tools.tools[0]);

const response = await client.models.generateContent({
  model: "gemini-1.5-flash-latest",
  contents: 'I want to send the "Salut Antoine, welcome back" message to number +XXXX from "Jean-Pierre" using conversation app id "YYYY" the region to be used "us"',
  config: tools
});

console.debug("response",  response);

console.log("Output text:", response.text);

await client.close();