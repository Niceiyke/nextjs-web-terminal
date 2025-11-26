import { createClient } from "@/lib/supabase/server";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-change-this-32chars";

// Ensure encryption key is 32 bytes
function getKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, "salt", 32);
}

// Encrypt password
export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// Decrypt password
export function decrypt(text: string): string {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// SSH Key interface
export interface SSHKey {
  id: string;
  type: "file" | "uploaded";
  content?: string;
  filePath?: string;
  passphrase?: string;
  fingerprint?: string;
  isPrimary: boolean;
}

// Connection interface
export interface Connection {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  auth_method: "password" | "key";
  private_key?: string;
  passphrase?: string;
  private_key_content?: string;
  key_type?: "file" | "uploaded";
  key_fingerprint?: string;
  ssh_keys?: SSHKey[];
  created_at: string;
  updated_at: string;
}

export interface ConnectionInput {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  auth_method: "password" | "key";
  private_key?: string;
  passphrase?: string;
  private_key_content?: string;
  key_type?: "file" | "uploaded";
  ssh_keys?: SSHKey[];
}

// Create connection
export async function createConnection(
  userId: string,
  input: ConnectionInput
): Promise<Connection | null> {
  const supabase = createClient();

  // Encrypt sensitive fields
  const encryptedPassword = input.password ? encrypt(input.password) : null;
  const encryptedPassphrase = input.passphrase
    ? encrypt(input.passphrase)
    : null;
  const encryptedKeyContent = input.private_key_content
    ? encrypt(input.private_key_content)
    : null;

  // Encrypt SSH keys if provided
  let sshKeysJson = null;
  if (input.ssh_keys && input.ssh_keys.length > 0) {
    const encryptedKeys = input.ssh_keys.map((key) => ({
      ...key,
      content: key.content ? encrypt(key.content) : undefined,
      passphrase: key.passphrase ? encrypt(key.passphrase) : undefined,
    }));
    sshKeysJson = encryptedKeys;
  }

  const { data, error } = await supabase
    .from("connections")
    .insert({
      user_id: userId,
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      password: encryptedPassword,
      auth_method: input.auth_method,
      private_key: input.private_key || null,
      passphrase: encryptedPassphrase,
      private_key_content: encryptedKeyContent,
      key_type: input.key_type || "file",
      ssh_keys: sshKeysJson,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating connection:", error);
    return null;
  }

  return data as Connection;
}

// Get connection by ID
export async function getConnection(
  userId: string,
  id: string
): Promise<Connection | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching connection:", error);
    return null;
  }

  return data as Connection;
}

// Get all connections for user
export async function getAllConnections(userId: string): Promise<Connection[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching connections:", error);
    return [];
  }

  return data as Connection[];
}

// Update connection
export async function updateConnection(
  userId: string,
  id: string,
  input: Partial<ConnectionInput>
): Promise<Connection | null> {
  const supabase = createClient();

  // Build update object with encryption
  const updates: any = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.host !== undefined) updates.host = input.host;
  if (input.port !== undefined) updates.port = input.port;
  if (input.username !== undefined) updates.username = input.username;
  if (input.password !== undefined) {
    updates.password = input.password ? encrypt(input.password) : null;
  }
  if (input.auth_method !== undefined) updates.auth_method = input.auth_method;
  if (input.private_key !== undefined) updates.private_key = input.private_key;
  if (input.passphrase !== undefined) {
    updates.passphrase = input.passphrase ? encrypt(input.passphrase) : null;
  }
  if (input.private_key_content !== undefined) {
    updates.private_key_content = input.private_key_content
      ? encrypt(input.private_key_content)
      : null;
  }
  if (input.key_type !== undefined) updates.key_type = input.key_type;
  if (input.ssh_keys !== undefined) {
    if (input.ssh_keys && input.ssh_keys.length > 0) {
      const encryptedKeys = input.ssh_keys.map((key) => ({
        ...key,
        content: key.content ? encrypt(key.content) : undefined,
        passphrase: key.passphrase ? encrypt(key.passphrase) : undefined,
      }));
      updates.ssh_keys = encryptedKeys;
    } else {
      updates.ssh_keys = null;
    }
  }

  const { data, error } = await supabase
    .from("connections")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating connection:", error);
    return null;
  }

  return data as Connection;
}

// Delete connection
export async function deleteConnection(
  userId: string,
  id: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting connection:", error);
    return false;
  }

  return true;
}

// Get decrypted connection for SSH
export async function getDecryptedConnection(
  userId: string,
  id: string
): Promise<ConnectionInput | null> {
  const conn = await getConnection(userId, id);
  if (!conn) return null;

  // Decrypt SSH keys if present
  let decryptedKeys: SSHKey[] | undefined;
  if (
    conn.ssh_keys &&
    Array.isArray(conn.ssh_keys) &&
    conn.ssh_keys.length > 0
  ) {
    decryptedKeys = conn.ssh_keys.map((key: any) => ({
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
    auth_method: conn.auth_method,
    private_key: conn.private_key || undefined,
    passphrase: conn.passphrase ? decrypt(conn.passphrase) : undefined,
    private_key_content: conn.private_key_content
      ? decrypt(conn.private_key_content)
      : undefined,
    key_type: conn.key_type,
    ssh_keys: decryptedKeys, // Corrected property name to match the expected schema
  };
}

// Calculate SSH key fingerprint
export function calculateFingerprint(publicKey: string): string {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(publicKey).digest("base64");
  return `SHA256:${hash}`;
}
