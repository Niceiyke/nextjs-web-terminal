const { createDecipheriv, randomBytes, scryptSync } = require("crypto");
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-change-this-32chars";
// Supabase-based DB wrapper used by server.js
const { createClient } = require("@supabase/supabase-js");

// Use service role key if available, fallback to anon key
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    "Supabase not configured: SUPABASE_URL and keys missing; getDecryptedConnection will return null."
  );
} else {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error("Failed creating Supabase client:", err);
    supabase = null;
  }
}
const ALGORITHM = "aes-256-cbc";

function getKey() {
  return scryptSync(ENCRYPTION_KEY, "salt", 32);
}

function decrypt(text) {
  if (!text) return null;
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// (Already initialized above)

// Query Supabase connections table and return a decrypted, camelCase connection object
async function getDecryptedConnection(id) {
  try {
    if (!supabase) {
      console.error("Supabase client not available; cannot fetch connection");
      return null;
    }
    const { data, error } = await supabase
      .from("connections")
      .select("*")
      .eq("id", id)
      .limit(1)
      .single();
    if (error) {
      console.error("Supabase error fetching connection:", error);
      return null;
    }
    const conn = data;
    if (!conn) return null;

    // Parse and decrypt ssh_keys if present
    let decryptedKeys;
    if (
      conn.ssh_keys &&
      Array.isArray(conn.ssh_keys) &&
      conn.ssh_keys.length > 0
    ) {
      decryptedKeys = conn.ssh_keys.map((key) => ({
        ...key,
        content: key.content ? decrypt(key.content) : undefined,
        passphrase: key.passphrase ? decrypt(key.passphrase) : undefined,
      }));
    }

    return {
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password ? decrypt(conn.password) : undefined,
      authMethod: conn.auth_method || conn.authMethod,
      privateKey: conn.private_key || undefined,
      passphrase: conn.passphrase ? decrypt(conn.passphrase) : undefined,
      privateKeyContent: conn.private_key_content
        ? decrypt(conn.private_key_content)
        : undefined,
      keyType: conn.key_type || conn.keyType,
      sshKeys: decryptedKeys,
    };
  } catch (err) {
    console.error("Error in getDecryptedConnection:", err);
    return null;
  }
}
module.exports = { getDecryptedConnection, decrypt };
