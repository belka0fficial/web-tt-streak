/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
  // instrumentation.ts is enabled by default in Next.js 14.2+
};

export default nextConfig;
