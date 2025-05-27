# Sinch MCP Server

## Getting Started

### 0. Prerequisites

  - Node.js >= 20.18.1
  - npm >= 9
  - A provisioned [Sinch Build account](https://dashboard.sinch.com/dashboard)
  - Claude Desktop (or any other MCP client). This README is focused on Claude Desktop, but the MCP server can be used with any MCP client.
  - Clone this repository

```bash
git clone https://github.com/sinch/sinch-mcp-server.git
```

### 1. API credentials

To use the APIs used by the MCP tools, you will need the following credentials:
- Conversation API credentials:
  - CONVERSATION_PROJECT_ID: Select the project you want to use from your [Sinch Build dashboard](https://dashboard.sinch.com/dashboard) (Located at the left of the top toolbar)
  - CONVERSATION_KEY_ID: Select or create a new access key in the [Access keys section](https://dashboard.sinch.com/settings/access-keys) of the Sinch Build dashboard.
  - CONVERSATION_KEY_SECRET: This is the secret associated with the `Access Key` you selected or created in the previous step. Be careful, the `Access Key Secret` is only shown once when you create the `Access Key`. If you lose it, you will need to create a new `Access Key`.
  - CONVERSATION_REGION: This is the region where your conversation app and templates are located. It can be `us`, `eu`, or `br`. If you don't set it, it defaults to `us`.
  - In case you want to use the SMS channel, you can also set the `DEFAULT_SMS_ORIGINATOR` environment variable to the phone number that will be used as the sender for SMS messages. Depending on your country, this setting may be required.
  - You can also set the `GEOCODING_API_KEY` environment variable to your Google Geocoding API key if you want to use the location feature. This is needed to convert an address to a latitude/longitude pair.
- Verification API credentials: navigate to the [Verification / Apps section](https://dashboard.sinch.com/verification/apps) of the Sinch Build dashboard and create a new app or select an existing one. You will need the following credentials:
  - VERIFICATION_APPLICATION_KEY
  - VERIFICATION_APPLICATION_SECRET
- Voice API credentials: navigate to the [Voice / Apps section](https://dashboard.sinch.com/voice/apps) of the Sinch Build dashboard and create a new app or select an existing one. You will need the following credentials:
  - VOICE_APPLICATION_KEY
  - VOICE_APPLICATION_SECRET
  - You can also set the `CALLING_LINE_IDENTIFICATION` environment variable to the phone number that will be displayed to the user when they receive a call.
- Mailgun API credentials: navigate to the [Mailgun / Domains section](https://app.mailgun.com/app/domains) of the Mailgun dashboard and create a new domain or select an existing one. You will need the following credentials:
  - MAILGUN_DOMAIN
  - MAILGUN_API_KEY
  - MAILGUN_SENDER_ADDRESS

## 2. Start the MCP server on stdio with Claude Desktop (Option 1)

### 2.1 Build the MCP server

```bash
cd sinch-mcp-server/mcp
npm install
npm run build
```

### 2.2 Setup Claude Desktop configuration

Here is an example of how to configure the MCP server in the Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sinch": {
      "command": "node",
      "args": [
        "/your/path/to/sinch-mcp-server/mcp/dist/index.js"
      ],
      "env": {
        "CONVERSATION_PROJECT_ID": "YOUR_PROJECT_ID",
        "CONVERSATION_KEY_ID": "YOUR_ACCESS_KEY_ID",
        "CONVERSATION_KEY_SECRET": "YOUR_ACCESS_KEY_SECRET",
        "CONVERSATION_REGION": "YOUR_REGION (optional, default to US)",
        "DEFAULT_SMS_ORIGINATOR": "YOUR_DEFAULT_SMS_ORIGINATOR (required in some countries if you want to send SMS messages)",
        "GEOCODING_API_KEY": "YOUR_GOOGLE_GEOCODING_API_KEY (optional, needed only if you want to send location messages)",
        "VERIFICATION_APPLICATION_KEY": "YOUR_VERIFICATION_APP_KEY",
        "VERIFICATION_APPLICATION_SECRET": "YOUR_VERIFICATION_APP_SECRET",
        "VOICE_APPLICATION_KEY": "YOUR_VOICE_APP_KEY",
        "VOICE_APPLICATION_SECRET": "YOUR_VOICE_APP_SECRET",
        "CALLING_LINE_IDENTIFICATION": "YOUR_CALLING_NUMBER",
        "MAILGUN_DOMAIN": "YOUR_MAILGUN_DOMAIN",
        "MAILGUN_API_KEY": "YOUR_MAILGUN_API_KEY",
        "MAILGUN_SENDER_ADDRESS": "YOUR_MAILGUN_SENDER_ADDRESS"
      }
    }
  }
}
```

## 3. Start the MCP server remotely and connect it using SSE  (Option 2)

### 3.1 Build the MCP server

```bash
cd sinch-mcp-server/mcp
npm install
npm run build
```

### 3.2 Setup the MCP server configuration

Copy the following lines at `<your_project_root>/mcp/.env` and replace the values with your own credentials:
```bash
# Conversation tools related environment variables
CONVERSATION_PROJECT_ID=YOUR_PROJECT_ID
CONVERSATION_KEY_ID=YOUR_ACCESS_KEY_ID
CONVERSATION_KEY_SECRET=YOUR_ACCESS_KEY_SECRET
CONVERSATION_REGION=YOUR_REGION // Optional, defaults to "us"
DEFAULT_SMS_ORIGINATOR=YOUR_SINCH_PHONE_NUMBER  // Needed only if you want to send SMS messages: it is the number that will be used as the sender for SMS messages
GEOCODING_API_KEY=YOUR_GOOGLE_GEOCODING_API_KEY // Needed only if you want to send location messages: it converts an address to a lat/lon
# Verification tools related environment variables
VERIFICATION_APPLICATION_KEY=YOUR_APP_KEY
VERIFICATION_APPLICATION_SECRET=YOUR_APP_SECRET
# Voice tools related environment variables
VOICE_APPLICATION_KEY=YOUR_APP_KEY              // Can be the same value as VERIFICATION_APPLICATION_KEY
VOICE_APPLICATION_SECRET=YOUR_APP_SECRET        // Can be the same value as VERIFICATION_APPLICATION_SECRET
CALLING_LINE_IDENTIFICATION=YOUR_CALLING_NUMBER // Needed only to make calls: it is the number that will be displayed to the user when they receive a call
# Mailgun tools related environment variables
MAILGUN_DOMAIN=YOUR_MAILGUN_DOMAIN
MAILGUN_API_KEY=YOUR_MAILGUN_API_KEY
MAILGUN_SENDER_ADDRESS=YOUR_MAILGUN_SENDER_ADDRESS
```

### 3.3 Start the MCP server

```bash
npm run start
```

### 3.4 Configure the MCP server in Claude Desktop

You can then configure the MCP server in the Claude configuration file as follows:
```json
{
  "mcpServers": {
    "sinch": {
      "command": "npx",
      "args": [
        "-y", "supergateway", "--sse", "http://localhost:8000/sse"
      ]
    }
  }
}
```
(Replace the `http://localhost:8000/sse` with the URL of your MCP server if it is not running locally)


## Defining new tools

Tools are registered in the `src/mcp/server.ts` file.
 - Conversation tools: send various types of messages, list conversations apps, templates
 - Verification tools: lookup for a number, perform a verification flow
 - Voice tools: make a TTS call, create a conference call, manage participants
 - Email tools: send emails, retrieve email information

Tools are defined under `src/mcp/tools/` and are registered in the `index.ts` file of their respective domain folder.
 - Verification tools: `src/mcp/tools/verification/index.ts`
 - Conversation tools: `src/mcp/tools/conversation/index.ts`
 - Voice tools: `src/mcp/tools/voice/index.ts`
 - Email tools: `src/mcp/tools/email/index.ts`
