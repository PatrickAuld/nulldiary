/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Disable x-powered-by header
  poweredByHeader: false,
};

module.exports = nextConfig;
