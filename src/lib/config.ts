// VPS Connection Configuration
// IMPORTANT: In production, use environment variables instead of hardcoding credentials

export const config = {
  // Web server settings
  webServer: {
    port: parseInt(process.env.PORT || '3000', 10),
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production-min-32-chars-long',
  },

  // VPS SSH connection settings
  vps: {
    host: process.env.VPS_HOST || 'your-vps-ip-or-domain',
    port: parseInt(process.env.VPS_PORT || '22', 10),
    username: process.env.VPS_USERNAME || 'your-username',
    
    // Authentication method 1: Password
    password: process.env.VPS_PASSWORD || 'your-password',
    
    // Authentication method 2: Private key (set VPS_PRIVATE_KEY_PATH env var)
    // privateKeyPath: process.env.VPS_PRIVATE_KEY_PATH,
    // passphrase: process.env.VPS_KEY_PASSPHRASE,
  },

  // Web interface authentication
  webAuth: {
    enabled: process.env.WEB_AUTH_ENABLED !== 'false',
    username: process.env.WEB_USERNAME || 'admin',
    password: process.env.WEB_PASSWORD || 'admin123', // CHANGE THIS!
  },
};

export type Config = typeof config;
