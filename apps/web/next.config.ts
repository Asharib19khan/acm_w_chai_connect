import type { NextConfig } from 'next';
// Validates environment variables at build time; a missing or leaked secret fails the build.
import './src/env';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@chai/core', '@chai/db', '@chai/ui'],
};

export default nextConfig;
