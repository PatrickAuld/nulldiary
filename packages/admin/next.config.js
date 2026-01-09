/** @type {import('next').NextConfig} */
const nextConfig = {
  // Not static export - needs server-side rendering for auth and API routes
  poweredByHeader: false,
};

module.exports = nextConfig;
