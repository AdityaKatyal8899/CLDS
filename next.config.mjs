/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow Node child_process in server components/route handlers
  experimental: {
    serverComponentsExternalPackages: ["mongodb"],
  },
};

export default nextConfig;
