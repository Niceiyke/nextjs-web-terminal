/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for pages that need WebSocket
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // ssh2 optionally tries to load native helpers (cpu-features/sshcrypto.node).
    // Mark them as external so Next.js doesn't try to bundle or resolve them.
    if (isServer) {
      const optionalNativeDeps = [
        'cpu-features',
        './crypto/build/Release/sshcrypto.node',
      ];

      optionalNativeDeps.forEach((mod) => {
        config.externals.push({ [mod]: `commonjs ${mod}` });
      });
    }

    return config;
  },
};

module.exports = nextConfig;
