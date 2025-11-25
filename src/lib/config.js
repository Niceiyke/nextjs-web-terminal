// CommonJS wrapper for config used by server.js
// Mirrors the structure exported by src/lib/config.ts
const config = {
  webServer: {
    port: parseInt(process.env.PORT || "3000", 10),
    sessionSecret:
      process.env.SESSION_SECRET ||
      "change-this-secret-in-production-min-32-chars-long",
  },
  vps: {
    host: process.env.VPS_HOST || "your-vps-ip-or-domain",
    port: parseInt(process.env.VPS_PORT || "22", 10),
    username: process.env.VPS_USERNAME || "your-username",
    password: process.env.VPS_PASSWORD || "your-password",
  },
  webAuth: {
    enabled: process.env.WEB_AUTH_ENABLED !== "false",
    username: process.env.WEB_USERNAME || "admin",
    password: process.env.WEB_PASSWORD || "admin123",
  },
};

module.exports = { config };
