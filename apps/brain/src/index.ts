/**
 * @brainpedia/brain — Brain-side service.
 *
 *   handler.ts → pure query handler (no transport assumptions)
 *   server.ts  → JSON-RPC HTTP server that registers with the AXL MCP
 *                router (POST /register {service, endpoint}) so incoming
 *                /mcp/{peer}/brainpedia.brain calls are forwarded here.
 *   cli.ts     → entry point reading env vars (run with `bun run start`)
 */
export {
  createBrainHandler,
  type BrainOptions,
  type BrainQueryRequest,
  type BrainQueryResult,
} from './handler.js';
export { startBrainServer } from './server.js';
