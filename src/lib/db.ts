import Database from 'better-sqlite3';
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

// SSH Key interface
export interface SSHKey {
  id: string;
  type: 'file' | 'uploaded';
  content?: string; // For uploaded keys (encrypted)
  filePath?: string; // For file-based keys
  passphrase?: string; // Encrypted
  fingerprint?: string;
  isPrimary: boolean;
}

// Connection interface
export interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string; // Encrypted
  authMethod: 'password' | 'key';
  privateKey?: string;
  passphrase?: string;
  privateKeyContent?: string; // New: uploaded key content
  keyType?: 'file' | 'uploaded';
  keyFingerprint?: string;
  sshKeys?: SSHKey[]; // Multiple keys support
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionInput {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  authMethod: 'password' | 'key';
  privateKey?: string;
  passphrase?: string;
  privateKeyContent?: string;
  keyType?: 'file' | 'uploaded';
  sshKeys?: SSHKey[];
}

// Initialize database
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Create connections table
    db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT,
        auth_method TEXT NOT NULL DEFAULT 'password',
        private_key TEXT,
        passphrase TEXT,
        private_key_content TEXT,
        key_type TEXT DEFAULT 'file',
        key_fingerprint TEXT,
        ssh_keys TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}

// CRUD operations
export function createConnection(input: ConnectionInput): Connection {
  const db = getDb();
  const encryptedPassword = input.password ? encrypt(input.password) : null;
  const encryptedPassphrase = input.passphrase ? encrypt(input.passphrase) : null;
  const encryptedKeyContent = input.privateKeyContent ? encrypt(input.privateKeyContent) : null;
  
  // Encrypt SSH keys if provided
  let sshKeysJson = null;
  if (input.sshKeys && input.sshKeys.length > 0) {
    const encryptedKeys = input.sshKeys.map(key => ({
      ...key,
      content: key.content ? encrypt(key.content) : undefined,
      passphrase: key.passphrase ? encrypt(key.passphrase) : undefined,
    }));
    sshKeysJson = JSON.stringify(encryptedKeys);
  }

  const stmt = db.prepare(`
    INSERT INTO connections (name, host, port, username, password, auth_method, private_key, passphrase, 
                            private_key_content, key_type, ssh_keys)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.name,
    input.host,
    input.port,
    input.username,
    encryptedPassword,
    input.authMethod,
    input.privateKey || null,
    encryptedPassphrase,
    encryptedKeyContent,
    input.keyType || 'file',
    sshKeysJson
  );

  return getConnection(Number(result.lastInsertRowid))!;
}

export function getConnection(id: number): Connection | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, name, host, port, username, password, auth_method as authMethod, 
           private_key as privateKey, passphrase, 
           private_key_content as privateKeyContent, key_type as keyType,
           key_fingerprint as keyFingerprint, ssh_keys as sshKeys,
           created_at as createdAt, updated_at as updatedAt
    FROM connections WHERE id = ?
  `);
  const result = stmt.get(id) as any;
  if (result && result.sshKeys) {
    result.sshKeys = JSON.parse(result.sshKeys);
  }
  return result as Connection | null;
}

export function getAllConnections(): Connection[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, name, host, port, username, password, auth_method as authMethod,
           private_key as privateKey, passphrase,
           private_key_content as privateKeyContent, key_type as keyType,
           key_fingerprint as keyFingerprint, ssh_keys as sshKeys,
           created_at as createdAt, updated_at as updatedAt
    FROM connections
    ORDER BY updated_at DESC
  `);
  const results = stmt.all() as any[];
  return results.map(result => {
    if (result.sshKeys) {
      result.sshKeys = JSON.parse(result.sshKeys);
    }
    return result as Connection;
  });
}

export function updateConnection(id: number, input: Partial<ConnectionInput>): Connection | null {
  const db = getDb();
  const current = getConnection(id);
  if (!current) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.host !== undefined) {
    updates.push('host = ?');
    values.push(input.host);
  }
  if (input.port !== undefined) {
    updates.push('port = ?');
    values.push(input.port);
  }
  if (input.username !== undefined) {
    updates.push('username = ?');
    values.push(input.username);
  }
  if (input.password !== undefined) {
    updates.push('password = ?');
    values.push(input.password ? encrypt(input.password) : null);
  }
  if (input.authMethod !== undefined) {
    updates.push('auth_method = ?');
    values.push(input.authMethod);
  }
  if (input.privateKey !== undefined) {
    updates.push('private_key = ?');
    values.push(input.privateKey);
  }
  if (input.passphrase !== undefined) {
    updates.push('passphrase = ?');
    values.push(input.passphrase ? encrypt(input.passphrase) : null);
  }
  if (input.privateKeyContent !== undefined) {
    updates.push('private_key_content = ?');
    values.push(input.privateKeyContent ? encrypt(input.privateKeyContent) : null);
  }
  if (input.keyType !== undefined) {
    updates.push('key_type = ?');
    values.push(input.keyType);
  }
  if (input.sshKeys !== undefined) {
    updates.push('ssh_keys = ?');
    if (input.sshKeys && input.sshKeys.length > 0) {
      const encryptedKeys = input.sshKeys.map(key => ({
        ...key,
        content: key.content ? encrypt(key.content) : undefined,
        passphrase: key.passphrase ? encrypt(key.passphrase) : undefined,
      }));
      values.push(JSON.stringify(encryptedKeys));
    } else {
      values.push(null);
    }
  }

  if (updates.length === 0) return current;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const stmt = db.prepare(`
    UPDATE connections 
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
  return getConnection(id);
}

export function deleteConnection(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM connections WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Get decrypted connection for SSH
export function getDecryptedConnection(id: number): ConnectionInput | null {
  const conn = getConnection(id);
  if (!conn) return null;

  // Decrypt SSH keys if present
  let decryptedKeys: SSHKey[] | undefined;
  if (conn.sshKeys && conn.sshKeys.length > 0) {
    decryptedKeys = conn.sshKeys.map(key => ({
      ...key,
      content: key.content ? decrypt(key.content) : undefined,
      passphrase: key.passphrase ? decrypt(key.passphrase) : undefined,
    }));
  }

  return {
    name: conn.name,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password ? decrypt(conn.password) : undefined,
    authMethod: conn.authMethod,
    privateKey: conn.privateKey || undefined,
    passphrase: conn.passphrase ? decrypt(conn.passphrase) : undefined,
    privateKeyContent: conn.privateKeyContent ? decrypt(conn.privateKeyContent) : undefined,
    keyType: conn.keyType,
    sshKeys: decryptedKeys,
  };
}

// Calculate SSH key fingerprint
export function calculateFingerprint(publicKey: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(publicKey).digest('base64');
  return `SHA256:${hash}`;
}
