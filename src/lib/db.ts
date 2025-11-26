import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'connections.db');

// Encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-this-32chars';
const ALGORITHM = 'aes-256-cbc';

// Ensure encryption key is 32 bytes
function getKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

// Encrypt password
export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt password
export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string | null;
  authMethod: 'password' | 'key';
  privateKey?: string | null;
  passphrase?: string | null;
  privateKeyContent?: string | null;
  keyType?: 'file' | 'uploaded';
  sshKeys?: SSHKey[];
}

export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  fingerprint?: string;
}

// NOTE: Database functionality removed - app uses Supabase instead
// The functions below are commented out since they're not used:
// export function createConnection(), getConnection(), getAllConnections(), 
// updateConnection(), deleteConnection(), etc.

// If needed in the future, uncomment and install better-sqlite3:
// npm install better-sqlite3 @types/better-sqlite3
