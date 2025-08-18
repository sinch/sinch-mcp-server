/**
 npm install @anthropic-ai/sdk
 export ANTHROPIC_API_KEY=
 */


import Anthropic from '@anthropic-ai/sdk';
import ngrok from '@ngrok/ngrok';

const client = new Anthropic({
//  apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
  logLevel: 'debug', // Show all log messages
});


export const openNgrokTunnel = async () => {
  const listener = await ngrok.forward({
    addr: "http://localhost:8000",
    authtoken: process.env.NGROK_AUTH_TOKEN,
  });

  const url = listener.url();
  if (!url) {
    throw new Error('Failed to obtain ngrok URL');
  }
  return url+"/sse";
}

const tunnel = await openNgrokTunnel()

console.log ("tunnel", tunnel)

const mcp_servers= [
  {
    type: "url",
    name: "Sinch-MCP-server",
    url: `${tunnel}`,
  }
]
console.log ("mcp_servers", mcp_servers)

const request = {
  max_tokens: 1024,
    messages: [
  {
    role: 'user',
    content: 'I want to send the "Salut Antoine, welcome back" message to number +XXXXX from "Jean-Pierre" using conversation app id "YYYYY" the region to be used "us"'
  }
],
  //model: 'claude-sonnet-4-20250514',
  model: 'claude-3-7-sonnet-latest',

  mcp_servers: mcp_servers,
  betas: ["mcp-client-2025-04-04"]
};

console.debug("request",  request);

const response = await client.beta.messages.create(request);

console.debug("response",  response);

console.log("Output text:", response.content);