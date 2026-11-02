import type { NextConfig } from 'next';
// Validates environment variables at build time; a missing or leaked secret fails the build.
import './src/env';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a second dev copy run beside the main one (its own build folder).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@chai/core', '@chai/db', '@chai/ui', '@chai/ai'],
  // CVs are capped at 4 MB, under Vercel Hobby's 4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
