import type { NextConfig } from 'next';
// Validates environment variables at build time; a missing or leaked secret fails the build.
import './src/env';

const nextConfig: NextConfig = {
  // A second dev copy (e.g. a test desk on scratch data) can build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@chai/core', '@chai/db', '@chai/ui', '@chai/ai'],
};

export default nextConfig;
