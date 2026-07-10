/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ticketing/db', '@ticketing/shared'],
};

export default nextConfig;
