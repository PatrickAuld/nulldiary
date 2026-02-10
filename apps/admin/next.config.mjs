/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@nulldiary/db"],
  serverExternalPackages: ["postgres"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
