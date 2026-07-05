#!/usr/bin/env node
import { startBrainServer } from './server.js';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`brain: missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

const opts = {
  // Railway injects PORT; locally we default to BRAIN_PORT/7100.
  port: Number(process.env.BRAIN_PORT ?? process.env.PORT ?? 7100),
  // Empty string / unset means "skip router registration" — brain still serves /mcp.
  routerUrl: process.env.BRAIN_ROUTER_URL ?? '',
  serviceName: process.env.BRAIN_SERVICE_NAME ?? 'brainpedia.brain',
  signerPrivateKey: must('ZG_WALLET_PRIVATE_KEY'),
  ensName: must('BRAIN_ENS_NAME'),
  storageRoot: must('BRAIN_STORAGE_ROOT'),
  specialty: must('BRAIN_SPECIALTY'),
  topK: Number(process.env.BRAIN_TOP_K ?? 4),
  enforceAccessTokens: process.env.BRAIN_ENFORCE_ACCESS_TOKENS === 'true',
};

await startBrainServer(opts);
