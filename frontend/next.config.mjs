/** @type {import('next').NextConfig} */
const repo = 'Coolpc-Price-Dashboard';
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  basePath: isProd ? `/${repo}` : '',
  assetPrefix: isProd ? `/${repo}/` : '',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? `/${repo}` : '',
  },
};

export default nextConfig;
