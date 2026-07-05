import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@brainpedia/brain',
    '@brainpedia/ens',
    '@brainpedia/storage-0g',
    '@brainpedia/compute-btl',
  ],
  typedRoutes: true,
};

export default config;
