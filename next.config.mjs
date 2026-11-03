/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  experimental: { cpus: 2 },
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};
export default config;
