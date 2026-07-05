#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { setupBrainTool, handleSetupBrain } from './tools/setup-brain.js';
import { uploadArticlesTool, handleUploadArticles } from './tools/upload-articles.js';
import { finalizeBrainTool, handleFinalizeBrain } from './tools/finalize-brain.js';
import { syncVaultTool, handleSyncVault } from './tools/sync-vault.js';
import { queryBrainTool, handleQueryBrain } from './tools/query-brain.js';
import { queryMixtureTool, handleQueryMixture } from './tools/query-mixture.js';
import { settleMixtureTool, handleSettleMixture } from './tools/settle-mixture.js';

const server = new Server(
  {
    name: 'brainpedia',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    setupBrainTool,
    uploadArticlesTool,
    finalizeBrainTool,
    syncVaultTool,
    queryBrainTool,
    queryMixtureTool,
    settleMixtureTool,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'setup_brain':
      return handleSetupBrain(args ?? {});
    case 'upload_articles':
      return handleUploadArticles(args ?? {});
    case 'finalize_brain':
      return handleFinalizeBrain(args ?? {});
    case 'sync_vault':
      return handleSyncVault(args ?? {});
    case 'query_brain':
      return handleQueryBrain(args ?? {});
    case 'query_mixture':
      return handleQueryMixture(args ?? {});
    case 'settle_mixture':
      return handleSettleMixture(args ?? {});
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Surface fatal errors to Claude Desktop's MCP log
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[brainpedia-mcp] uncaughtException', err);
});
