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
      '@brainpedia/compute-btl': path.resolve(root, '../../packages/compute-btl/src'),
    };
    // NodeNext .js imports in brain/src (e.g. ./handler.js) → actual .ts files.
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return webpackConfig;
  },
};

export default config;
