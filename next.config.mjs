/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
    instrumentationHook: true, // required until Next.js 15 — loads instrumentation.ts
  },
};

export default nextConfig;
