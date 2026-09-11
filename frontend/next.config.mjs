/** @type {import('next').NextConfig} */
const repo = 'Coolpc-Price-Dashboard';
const isProd = process.env.NODE_ENV === 'production';

  // 讓 public/data 可以被 build 時讀取
  // 我們會在 workflow 裡把 data/ 複製到 frontend/public/data/
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
