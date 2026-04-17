/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
    instrumentationHook: true,
  },
};

export default nextConfig;
