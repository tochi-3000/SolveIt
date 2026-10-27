/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@solvam/shared-types'],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
