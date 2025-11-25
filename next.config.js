/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for pages that need WebSocket
  output: 'standalone',
}

module.exports = nextConfig
