/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ticketing/db', '@ticketing/shared'],
  images: {
    contentDispositionType: 'inline',
  },
};

export default nextConfig;
