import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const root = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@brainpedia/brain',
    '@brainpedia/ens',
    '@brainpedia/storage-0g',
    '@brainpedia/compute-btl',
  ],
  typedRoutes: true,
  webpack: (webpackConfig) => {
    // Compile brain handler from source so creator-brain fixes aren't gated on dist rebuilds.
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      '@brainpedia/brain': path.resolve(root, '../brain/src'),
    };
    return webpackConfig;
  },
};

export default config;
