import cors from 'cors';
import express from 'express';
import { storeCredential } from './db-utils.js';

const server = express();
server.use(express.json());

server.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

/**
 * Receives a keyId and a keySecret from the client and returns an OAuth2 token from Sinch API.
 */
server.post('/auth', async (req, res) => {
  const { keyId, keySecret } = req.body;

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://auth.sinch.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
  });

  const data = await response.json();
  res.json(data);
});

/**
 * Receives a token, a projectId and a sessionId from the client and stores them in memory.
 */
server.post('/callback/conversation', (req, res) => {
  const { token, sessionId, projectId } = req.body;

  if (!token || !sessionId) {
    res.status(400).send('Missing token or sessionId');
    return;
  }

  storeCredential(sessionId, 'conversation', { projectId, token });
  res.sendStatus(200);
  return;
});

/**
 * Receives a pair of application Id and key as well as a sessionId from the client and stores them in memory.
 */
server.post('/callback/verification', (req, res) => {
  const { sessionId, appId, appSecret } = req.body;

  if (!sessionId || !appId || !appSecret) {
    res.status(400).send('Missing credentials');
    return;
  }

  storeCredential(sessionId, 'verification', { appId, appSecret });
  res.sendStatus(200);
  return;
});

server.listen(4399, () => {
  console.log('🍁 Authumn server running on port 4399');
});
