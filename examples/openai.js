/**
 npm install openai
 export OPENAI_API_KEY=
 */


import OpenAI from "openai";
import ngrok from '@ngrok/ngrok';
const client = new OpenAI({
  //apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
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

const tools= [
  {
    "type": "mcp",
    "server_label": "Sinch-MCP-server",
    "server_url": `${tunnel}`,
    "require_approval": "never"
  }
]
console.log ("tools", tools)


const response = await client.responses.create({
  model: "gpt-4.1",
  input: 'I want to send the "Salut Antoine, welcome back" message to number +XXXX from "Jean-Pierre" using conversation app id "YYYY" the region to be used "us"',
  tools: tools
});

console.debug("response",  response);

console.log("Output text:", response.output_text);