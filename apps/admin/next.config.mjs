/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@nulldiary/db"],
  serverExternalPackages: ["postgres"],
  eslint: {
    // CI runs lint separately; don't fail builds (Vercel) on lint rules.
    ignoreDuringBuilds: true,
  },
  // Admin uses runtime env vars (Supabase) and should not be statically exported.
  output: "standalone",
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
