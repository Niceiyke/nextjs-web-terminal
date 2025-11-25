require('dotenv').config({ path: '.env.local' });

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const WebSocket = require("ws");
const { Client } = require("ssh2");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const projectRefMatch = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(
  /https?:\/\/([^.]+)\./
);
const supabaseProjectRef = projectRefMatch ? projectRefMatch[1] : null;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Import config and database
let config;
let getDecryptedConnection;
let decryptValue;
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-change-this-32chars";
const ALGORITHM = "aes-256-cbc";
try {
  const dbModule = require("./src/lib/db.js");
  config = require("./src/lib/config.js").config;
  getDecryptedConnection = dbModule.getDecryptedConnection;
  decryptValue = dbModule.decrypt;
} catch (error) {
  console.error("Error loading modules:", error);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('Invalid WebSocket frame')) {
    console.error('WebSocket frame error (handled):', err.message);
    return;
  }
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Normalize PKCS8 ("BEGIN PRIVATE KEY") to PKCS1 so ssh2 can parse it
function normalizePrivateKey(keyContent, passphrase) {
  try {
    if (!keyContent || !keyContent.includes("BEGIN PRIVATE KEY")) {
      return keyContent;
    }
    const keyObj = crypto.createPrivateKey({
      key: keyContent,
      format: "pem",
      ...(passphrase ? { passphrase } : {}),
    });
    return keyObj.export({ type: "pkcs1", format: "pem" }).toString();
  } catch (err) {
    console.warn("Could not normalize private key format:", err.message);
    return keyContent;
  }
}

// Some records may still contain encrypted fields; decrypt when the pattern matches.
function maybeDecrypt(value) {
  if (!value || typeof value !== "string") return value;
  if (!value.includes(":")) return value;
  try {
    if (decryptValue) {
      return decryptValue(value);
    }
  } catch (_) {
    // fall through to fallback decrypt
  }

  try {
    // Fallback decrypt using local env key in case module decrypt was initialized without env vars.
    const [ivHex, dataHex] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (fallbackErr) {
    console.warn("Could not decrypt value; using raw:", fallbackErr.message);
    return value;
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  // WebSocket Server - specifically handle /ws path
  const wss = new WebSocket.Server({
    noServer: true,
    perMessageDeflate: false,
    clientTracking: true,
  });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      console.log('WebSocket upgrade request for path:', url.pathname);
      
      if (url.pathname === '/ws') {
        console.log('Handling WebSocket upgrade for /ws');
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      } else {
        console.log('Destroying socket for non-/ws path:', url.pathname);
        socket.destroy();
      }
    } catch (err) {
      console.error('WebSocket upgrade error:', err);
      try {
        socket.destroy();
      } catch (destroyErr) {
        console.error('Error destroying socket:', destroyErr);
      }
    }
  });

  wss.on("connection", async (ws, req) => {
    console.log("=== WEB SOCKET CONNECTION ESTABLISHED ===");
    console.log("Request URL:", req.url);
    console.log("Headers:", req.headers);

    // Parse connection ID from query params
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const connectionId = urlParams.searchParams.get("connectionId");
    console.log("Connection ID received:", connectionId);
    console.log("Type of connectionId:", typeof connectionId);

    if (!connectionId) {
      console.log("=== ERROR: No connection ID provided ===");
      ws.send(
        JSON.stringify({
          type: "error",
          message:
            "No connection selected. Please select a connection and click Connect.",
        })
      );
      ws.close();
      return;
    }

    // Extract Supabase access token from cookie (to satisfy RLS)
    const parseSupabaseAuth = (cookieHeader) => {
      if (!cookieHeader || !supabaseProjectRef) return null;
      const cookieName = `sb-${supabaseProjectRef}-auth-token`;
      const parts = cookieHeader.split(";").map((c) => c.trim());
      const raw = parts.find((c) => c.startsWith(`${cookieName}=`));
      if (!raw) return null;
      try {
        const value = decodeURIComponent(raw.split("=").slice(1).join("="));
        return JSON.parse(value);
      } catch (err) {
        console.error("Failed to parse Supabase auth cookie:", err);
        return null;
      }
    };

    const supabaseAuth = parseSupabaseAuth(req.headers.cookie);
    const accessToken = supabaseAuth?.access_token;
    const userId = supabaseAuth?.user?.id;

    if (!accessToken) {
      console.error("=== ERROR: Missing Supabase access token in cookies ===");
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Authentication required. Please log in again.",
        })
      );
      ws.close();
      return;
    }

    // Get connection details from database
    let connectionConfig;
    try {
      console.log("=== FETCHING CONNECTION FROM DATABASE ===");
      console.log("Calling getDecryptedConnection with ID:", connectionId);
      connectionConfig = await getDecryptedConnection(connectionId, {
        accessToken,
        userId,
      });
      console.log("Database response:", connectionConfig);

      if (!connectionConfig) {
        console.log("=== ERROR: Connection not found in database ===");
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Connection not found. Please check your connection settings.",
          })
        );
        ws.close();
        return;
      }
    } catch (error) {
      console.error("=== ERROR FETCHING CONNECTION ===");
      console.error("Error details:", error);
      console.error("Error stack:", error.stack);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to load connection settings: " + error.message,
        })
      );
      ws.close();
      return;
    }

    console.log(
      `=== SSH CONNECTION ATTEMPT ===`
    );
    console.log(
      `Connecting to: ${connectionConfig.username}@${connectionConfig.host}:${connectionConfig.port}`
    );
    console.log("Auth method:", connectionConfig.authMethod);
    console.log("Has password:", !!connectionConfig.password);
    console.log("Has SSH keys:", connectionConfig.sshKeys ? connectionConfig.sshKeys.length : 0);

    // Build SSH config
    const sshConfig = {
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      readyTimeout: 20000,
    };

    // Add authentication based on method
    const decryptedPassword = maybeDecrypt(connectionConfig.password);

    if (
      connectionConfig.authMethod === "password" &&
      decryptedPassword
    ) {
      sshConfig.password = decryptedPassword;
    } else if (connectionConfig.authMethod === "key") {
      // Handle multiple SSH keys with fallback
      if (connectionConfig.sshKeys && connectionConfig.sshKeys.length > 0) {
        const fs = require("fs");
        const keys = [];

        // Sort keys to put primary first
        const sortedKeys = [...connectionConfig.sshKeys].sort((a, b) => {
          if (a.isPrimary) return -1;
          if (b.isPrimary) return 1;
          return 0;
        });

        for (const key of sortedKeys) {
          try {
            let keyContent;

            if (key.type === "uploaded" && key.content) {
              // Use uploaded key content
              const decryptedPassphrase = maybeDecrypt(key.passphrase);
              const decryptedContent = maybeDecrypt(key.content);
              keyContent = normalizePrivateKey(decryptedContent, decryptedPassphrase);
            } else if (key.type === "file" && key.filePath) {
              // Read key from file
              keyContent = normalizePrivateKey(
                fs.readFileSync(key.filePath, "utf8"),
                maybeDecrypt(key.passphrase)
              );
            } else {
              continue; // Skip invalid keys
            }

            const keyConfig = { privateKey: keyContent };
            const decryptedPass = maybeDecrypt(key.passphrase);
            if (decryptedPass) {
              keyConfig.passphrase = decryptedPass;
            }

            keys.push(keyConfig);
          } catch (error) {
            console.error(`Error loading SSH key ${key.id}:`, error.message);
            // Continue to next key
          }
        }

        if (keys.length === 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "No valid SSH keys found.",
            })
          );
          ws.close();
          return;
        }

        // Try keys in order
        sshConfig.privateKey = keys[0].privateKey;
        if (keys[0].passphrase) {
          sshConfig.passphrase = keys[0].passphrase;
        }

        // Store additional keys for fallback
        sshConfig.tryKeyboard = true;
        sshConfig._fallbackKeys = keys.slice(1);
      } else if (connectionConfig.privateKeyContent) {
        // Legacy: single uploaded key
        const decryptedPass = maybeDecrypt(connectionConfig.passphrase);
        const decryptedContent = maybeDecrypt(connectionConfig.privateKeyContent);
        sshConfig.privateKey = normalizePrivateKey(
          decryptedContent,
          decryptedPass
        );
        if (decryptedPass) {
          sshConfig.passphrase = decryptedPass;
        }
      } else if (connectionConfig.privateKey) {
        // Legacy: single file path
        const fs = require("fs");
        const decryptedPass = maybeDecrypt(connectionConfig.passphrase);
        try {
          sshConfig.privateKey = normalizePrivateKey(
            fs.readFileSync(connectionConfig.privateKey, "utf8"),
            decryptedPass
          );
          if (decryptedPass) {
            sshConfig.passphrase = decryptedPass;
          }
        } catch (error) {
          console.error("Error reading private key:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to read private key file: " + error.message,
            })
          );
          ws.close();
          return;
        }
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "No SSH key configured.",
          })
        );
        ws.close();
        return;
      }
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No authentication method configured.",
        })
      );
      ws.close();
      return;
    }

    // Handle key fallback on authentication failure
    let keyFallbackAttempted = false;
    const attemptConnection = (config) => {
      const sshAttempt = new Client();

      sshAttempt.on("error", (err) => {
        console.error("SSH connection error:", err);

        // Try fallback keys if available
        if (
          !keyFallbackAttempted &&
          config._fallbackKeys &&
          config._fallbackKeys.length > 0
        ) {
          keyFallbackAttempted = true;
          console.log(
            `Trying fallback key (${config._fallbackKeys.length} remaining)...`
          );

          const nextKey = config._fallbackKeys[0];
          const newConfig = {
            ...config,
            privateKey: nextKey.privateKey,
            passphrase: nextKey.passphrase,
            _fallbackKeys: config._fallbackKeys.slice(1),
          };

          attemptConnection(newConfig);
          return;
        }

        ws.send(
          JSON.stringify({
            type: "error",
            message: "SSH connection failed: " + err.message,
          })
        );
        ws.close();
      });

      sshAttempt.on("ready", () => {
        console.log("SSH connection established");
        ws.send(
          JSON.stringify({
            type: "status",
            message: `Connected to ${connectionConfig.name}`,
          })
        );

        // Start shell session
        sshAttempt.shell({ term: "xterm-256color" }, (err, stream) => {
          if (err) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to start shell: " + err.message,
              })
            );
            return ws.close();
          }

          // Forward data from SSH to WebSocket
          stream.on("data", (data) => {
            try {
              ws.send(
                JSON.stringify({ type: "data", data: data.toString("utf-8") })
              );
            } catch (e) {
              console.error("Error sending data to WebSocket:", e);
            }
          });

          // Handle stream close
          stream.on("close", () => {
            console.log("SSH stream closed");
            sshAttempt.end();
            ws.close();
          });

          // Forward data from WebSocket to SSH
          ws.on("message", (message) => {
            try {
              const msg = JSON.parse(message.toString());

              if (msg.type === "data") {
                stream.write(msg.data);
              } else if (msg.type === "resize") {
                stream.setWindow(msg.rows, msg.cols, msg.height, msg.width);
              }
            } catch (e) {
              console.error("Error processing WebSocket message:", e);
            }
          });

          // Handle WebSocket close
          ws.on("close", () => {
            console.log("WebSocket closed");
            sshAttempt.end();
          });
        });
      });

      sshAttempt.on("close", () => {
        console.log("SSH connection closed");
        ws.close();
      });

      sshAttempt.connect(config);
    };

    // Start connection attempt
    attemptConnection(sshConfig);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log("=".repeat(60));
    console.log("Next.js Web Terminal Server Running");
    console.log("=".repeat(60));
    console.log(`> Local:            http://${hostname}:${port}`);
    console.log(
      `> Web Auth:         ${config.webAuth.enabled ? "Enabled" : "Disabled"}`
    );
    console.log(`> Environment:      ${dev ? "Development" : "Production"}`);
    console.log(`> Database:         SQLite (data/connections.db)`);
    console.log("=".repeat(60));
    console.log("Connection management available at /connections");
    console.log("=".repeat(60));
  });
});
