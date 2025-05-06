import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'credentials.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize schema
const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

init();

export type CredentialType = 'conversation' | 'verification';

export interface OAuth2Token {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface SinchConversationCredentials {
  projectId: string;
  token: OAuth2Token;
}

export interface SinchVerificationCredentials {
  appId: string;
  appSecret: string;
}

type CredentialRow = {
  data: string;
};

export const getCredential = (id: string): SinchConversationCredentials | SinchVerificationCredentials | null => {
  const stmt = db.prepare('SELECT data FROM credentials WHERE id = ?');
  const row = stmt.get(id) as CredentialRow | undefined;
  return row ? JSON.parse(row.data) : null;
};

export const storeCredential = (id: string, type: CredentialType, data: SinchConversationCredentials | SinchVerificationCredentials): void => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO credentials (id, type, data)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, type, JSON.stringify(data));
};
