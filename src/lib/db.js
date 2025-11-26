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

const ALGORITHM = "aes-256-cbc";

function getKey() {
  return scryptSync(ENCRYPTION_KEY, "salt", 32);
}

function decrypt(text) {
  if (!text) return null;
  
  // Validate input format
  if (typeof text !== 'string' || !text.includes(':')) {
    console.error('Invalid encrypted text format:', text);
    return null;
  }
  
  const parts = text.split(":");
  if (parts.length !== 2) {
    console.error('Invalid encrypted text parts:', parts);
    return null;
  }
  
  try {
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    
    // Validate IV and encrypted text
    if (iv.length !== 16) {
      console.error('Invalid IV length:', iv.length, 'Expected: 16');
      return null;
    }
    
    if (!encryptedText || encryptedText.length === 0) {
      console.error('Empty encrypted text');
      return null;
    }
    
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error('Decryption error for text:', text, 'Error:', error.message);
    return null;
  }
}

function createSupabaseClient(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      "Supabase not configured: SUPABASE_URL and keys missing; getDecryptedConnection will return null."
    );
    return null;
  }

  try {
    const options = accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : undefined;

    return createClient(SUPABASE_URL, SUPABASE_KEY, options);
  } catch (err) {
    console.error("Failed creating Supabase client:", err);
    return null;
  }
}

// Query Supabase connections table and return a decrypted, camelCase connection object
async function getDecryptedConnection(id, opts = {}) {
  try {
    const supabase = createSupabaseClient(opts.accessToken);
    if (!supabase) {
      console.error("Supabase client not available; cannot fetch connection");
      return null;
    }

    let query = supabase.from("connections").select("*").eq("id", id).limit(1);
    if (opts.userId) {
      query = query.eq("user_id", opts.userId);
    }

    const { data, error } = await query.single();
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
      try {
        decryptedKeys = conn.ssh_keys.map((key, index) => ({
          ...key,
          content: key.content ? decrypt(key.content) : undefined,
          passphrase: key.passphrase ? decrypt(key.passphrase) : undefined,
        }));
      } catch (error) {
        console.error(`Error decrypting SSH keys for connection ${id}:`, error);
        decryptedKeys = conn.ssh_keys;
      }
    }

    // Safely decrypt fields with individual error handling
    let decryptedPassword, decryptedPassphrase, decryptedPrivateKeyContent;
    
    try {
      decryptedPassword = conn.password ? decrypt(conn.password) : undefined;
    } catch (error) {
      console.error(`Error decrypting password for connection ${id}:`, error);
      decryptedPassword = undefined;
    }
    
    try {
      decryptedPassphrase = conn.passphrase ? decrypt(conn.passphrase) : undefined;
    } catch (error) {
      console.error(`Error decrypting passphrase for connection ${id}:`, error);
      decryptedPassphrase = undefined;
    }
    
    try {
      decryptedPrivateKeyContent = conn.private_key_content
        ? decrypt(conn.private_key_content)
        : undefined;
    } catch (error) {
      console.error(`Error decrypting private key content for connection ${id}:`, error);
      decryptedPrivateKeyContent = undefined;
    }

    return {
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: decryptedPassword,
      authMethod: conn.auth_method || conn.authMethod,
      privateKey: conn.private_key || undefined,
      passphrase: decryptedPassphrase,
      privateKeyContent: decryptedPrivateKeyContent,
      keyType: conn.key_type || conn.keyType,
      sshKeys: decryptedKeys,
    };
  } catch (err) {
    console.error("Error in getDecryptedConnection:", err);
    return null;
  }
}
module.exports = { getDecryptedConnection, decrypt };
