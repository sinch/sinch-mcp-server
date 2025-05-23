# Sinch MCP Server Toolkit

A modular, authentication-aware toolkit built around the [Model Context Protocol (MCP)](https://modelcontext.org) to support dynamic, interactive tools with credential flows. Includes:
 - an SSE-exposed MCP server
 - an authentication UI
 - a BFF + callback API server

## Getting Started

### 0. Prerequisites

  - Node.js >= 18
  - npm >= 9
  - A provisioned [Sinch Build account](https://dashboard.sinch.com/dashboard)
  - Claude Desktop (or any other MCP client). This Readme is focused on Claude Desktop, but the toolkit can be used with any MCP client.
  - Clone this repository

```bash
git clone https://github.com/sinch/sinch-mcp-server.git
```

### 1. API credentials

To use the APIs used by the MCP tools, you will need the following credentials:
- Verification API credentials: navigate to the [Verification / Apps section](https://dashboard.sinch.com/verification/apps) of the Sinch Build dashboard and create a new app or select an existing one. You will need the following credentials:
    - VERIFICATION_APPLICATION_KEY
    - VERIFICATION_APPLICATION_SECRET
- Conversation API credentials:
    - CONVERSATION_PROJECT_ID: Select the project you want to use from your [Sinch Build dashboard](https://dashboard.sinch.com/dashboard) (Located at the left of the top toolbar)
    - CONVERSATION_KEY_ID: Select or create a new access key in the [Access keys section](https://dashboard.sinch.com/settings/access-keys) of the Sinch Build dashboard.
    - CONVERSATION_KEY_SECRET: This is the secret associated with the `Access Key` you selected or created in the previous step. Be careful, the `Access Key Secret` is only shown once when you create the `Access Key`. If you lose it, you will need to create a new `Access Key`.


### 2. Embedded mode

The embedded mode is a simple way to use the Sinch MCP server with your own AI client. You need to configure it with some environment variables.<br>
Copy the following lines at `<your_project_root>/packages/mcp/.env` and replace the values with your own credentials:
```bash
VERIFICATION_APPLICATION_KEY=YOUR_APP_KEY
VERIFICATION_APPLICATION_SECRET=YOUR_APP_SECRET
CONVERSATION_PROJECT_ID=YOUR_PROJECT_ID
CONVERSATION_KEY_ID=YOUR_ACCESS_KEY_ID
CONVERSATION_KEY_SECRET=YOUR_ACCESS_KEY_SECRET
CONVERSATION_REGION=YOUR_REGION // Optional, defaults to "us"
GEOCODING_API_KEY=YOUR_GOOGLE_GEOCODING_API_KEY // Needed only if you want to send location messages: it converts an address to a lat/lon
CALLING_LINE_IDENTIFICATION=YOUR_CALLING_NUMBER // Needed only to make calls: it is the number that will be displayed to the user when they receive a call
MAILGUN_DOMAIN=YOUR_MAILGUN_DOMAIN
MAILGUN_API_KEY=YOUR_MAILGUN_API_KEY
MAILGUN_SENDER_ADDRESS=YOUR_MAILGUN_SENDER_ADDRESS
```

#### 2.1 Build the MCP server

```bash
cd sinch-mcp-server/packages/mcp
npm install
npm run build
```

#### 2.2 Start the MCP server

**Option 1**: You can start the MCP server when declaring it in the Claude configuration file:

```json
{
  "mcpServers": {
    "sinch": {
      "command": "node",
      "args": [
        "/your/path/to/sinch-mcp-server/packages/mcp/dist/index.js"
      ],
      "env": {
        "VERIFICATION_APPLICATION_KEY": "YOUR_APP_KEY",
        "VERIFICATION_APPLICATION_SECRET": "YOUR_APP_SECRET",
        "CONVERSATION_PROJECT_ID": "YOUR_PROJECT_ID",
        "CONVERSATION_KEY_ID": "YOUR_ACCESS_KEY_ID",
        "CONVERSATION_KEY_SECRET": "YOUR_ACCESS_KEY_SECRET",
        "CONVERSATION_REGION": "YOUR_REGION", // Optional, defaults to "us"
        "DEFAULT_SMS_ORIGINATOR": "YOUR_DEFAULT_SMS_ORIGINATOR",
        "GEOCODING_API_KEY": "YOUR_GOOGLE_GEOCODING_API_KEY",
        "CALLING_LINE_IDENTIFICATION": "YOUR_CALLING_NUMBER",
        "MAILGUN_DOMAIN": "YOUR_MAILGUN_DOMAIN",
        "MAILGUN_API_KEY": "YOUR_MAILGUN_API_KEY",
        "MAILGUN_SENDER_ADDRESS": "YOUR_MAILGUN_SENDER_ADDRESS"
      }
    }
  }
}
```

**Option 2**: You can start the MCP server remotely and expose it as an SSE endpoint using `supergateway`:

```bash
npm run start
```
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

### 3. SaaS mode

The SaaS mode is a different way to use the Sinch MCP server. Instead of being used by an identified user who manages the installation, the server is exposed as a service for anybody who wants to consume the Sinch APIs with AI.

When a user submits a prompt to the server, the server will ask for the credentials to use the Sinch APIs. The user will be able to enter their own credentials and use the Sinch APIs with their own account.

In order to achieve this, three components are needed:
 - The MCP server: this is the server that will be used to expose the tools. Note that NO ENVIRONMENT VARIABLES must be set in the `.env` file. The server will use the credentials provided by the user.
 - The authentication UI to collect the user's credentials
 - The Authumn server 🍁 to manage the authentication flow

#### 3.1 Start the authentication UI server

The authentication UI displays 2 forms:
- /auth/conversation: where the user can fill in their `projectId` / `keyId` / `keySecret`
- /auth/verification: where the user can fill in their verification `appId` / `appSecret`

```bash
cd sinch-mcp-server/packages/auth-ui
npm install
npm run start
```

#### 3.2 Start the authentication callback server

The authentication callback server will link the user's credentials their session.
```bash
cd sinch-mcp-server/packages/authumn
npm install
npm run start
```

#### 3.3 Start the MCP server

The only way that makes sense to start the MCP server is in SaaS mode. This will expose the server as an SSE endpoint.<br>
A user will be able to connect to the MCP server thanks to tools like `supergateway` or `mcp-remote`.

Note that **NO ENVIRONMENT VARIABLES must be set in the .env file**. The server will use the credentials provided by the user.

```bash
cd sinch-mcp-server/packages/mcp
npm install
npm run start
```

#### 3.4 Configure the MCP client

 - With [`supergateway`](https://www.npmjs.com/package/supergateway):

```json
{
  "mcpServers": {
    "sinch": {
      "command": "npx",
      "args": [
        "-y", "supergateway", "-sse", "https://your.domain.com/sse"
      ]
    }
  }
}
```

 - With [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):
```json
{
  "mcpServers": {
    "sinch": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://your.domain.com/sse"
      ]
    }
  }
}
```

## Defining new tools

Tools are registered in the `src/mcp/server.ts` file.
 - Verification tools: lookup for a number, perform a verification flow
 - Conversation tools: send a message, create a conversation app, configure webhooks, list conversations...

Tools are defined under `src/mcp/tools/` and are registered in the `index.ts` file of their respective domain folder.
 - Verification tools: `src/mcp/tools/verification/index.ts`
 - Conversation tools: `src/mcp/tools/conversation/index.ts`
 - Voice tools: `src/mcp/tools/voice/index.ts`
 - Email tools: `src/mcp/tools/email/index.ts`
