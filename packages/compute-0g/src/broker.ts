import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import type { ComputeConfig } from './config.js';

export interface ProviderInfo {
  address: string;
  url: string;
  model: string;
  inputPrice?: bigint;
  outputPrice?: bigint;
}

/**
 * Per-request inference handle returned by `getInferenceClient(provider)`.
 *
 * The 0G broker (>=0.7) generates fresh signed headers per request via
 * `broker.inference.getRequestHeaders(provider, content)` — these replace
 * the deprecated `getProcessedSecret` flow. Always pass the *exact* content
 * to `headersFor` that you'll send to the model, otherwise the provider
 * rejects the signature.
 */
export interface InferenceHandle {
  /** Endpoint already includes `/v1/proxy`. */
  endpoint: string;
  model: string;
  headersFor(content: string): Promise<Record<string, string>>;
  /** Verify the TEE-signed response after the call (unblocks billing). */
  verify(chatId: string, content: string): Promise<boolean>;
}

export interface BrokerHandle {
  listProviders(): Promise<ProviderInfo[]>;
  /**
   * One-shot setup before transferring funds:
   *   1. addLedger (idempotent-ish; required first time per wallet)
   *   2. depositFund        — units: OG (number)
   *   3. transferFund       — units: neuron (bigint, e.g. parseEther("5"))
   */
  ensureFunded(provider: string, depositOg: number, transferNeuron: bigint): Promise<void>;
  /**
   * Move funds from an EXISTING ledger into a provider's inference
   * sub-account. Does NOT addLedger or depositFund. Use when the ledger is
   * already created and you only need to (re)fund a specific provider.
   */
  topUpProvider(provider: string, transferNeuron: bigint): Promise<void>;
  /** Acknowledge a provider's TEE signer once per (user, provider). */
  acknowledgeProvider(provider: string): Promise<void>;
  /** Return a callable handle that produces fresh per-request headers. */
  getInferenceClient(provider: string): Promise<InferenceHandle>;
}

export function createBroker(cfg: ComputeConfig, signerPrivateKey: string): BrokerHandle {
  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const wallet = new Wallet(signerPrivateKey, provider);
  let cached: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

  async function broker() {
    // ESM/CJS dual-package hazard: SDK was built against ethers CJS,
    // our Wallet is from ethers ESM — structurally identical, types differ.
    if (!cached) cached = await createZGComputeNetworkBroker(wallet as never);
    return cached;
  }

  return {
    async listProviders() {
      const b = await broker();
      const services = await b.inference.listService();
      return services.map((s) => ({
        address: s.provider,
        url: s.url,
        model: s.model,
        inputPrice: s.inputPrice,
        outputPrice: s.outputPrice,
      }));
    },

    async ensureFunded(providerAddr, depositOg, transferNeuron) {
      const b = await broker();
      // addLedger(depositOg) BOTH creates the ledger AND deposits depositOg.
      // depositFund is only for topping up an EXISTING ledger. Calling both
      // double-deposits (addLedger 3 + depositFund 3 = 6 OG). So: try to
      // create; only fall back to depositFund if the ledger already exists.
      let ledgerExists = false;
      try {
        await b.ledger.getLedger();
        ledgerExists = true;
      } catch {
        ledgerExists = false;
      }
      if (!ledgerExists) {
        await b.ledger.addLedger(depositOg);
      } else {
        await b.ledger.depositFund(depositOg);
      }
      await b.ledger.transferFund(providerAddr, 'inference', transferNeuron);
    },

    async topUpProvider(providerAddr, transferNeuron) {
      const b = await broker();
      await b.ledger.transferFund(providerAddr, 'inference', transferNeuron);
    },

    async acknowledgeProvider(providerAddr) {
      const b = await broker();
      try {
        await b.inference.acknowledgeProviderSigner(providerAddr);
      } catch (err) {
        // Already acknowledged → contract reverts; ignore.
        const msg = (err as Error).message ?? '';
        if (!/already|acknowledged/i.test(msg)) throw err;
      }
    },

    async getInferenceClient(providerAddr) {
      const b = await broker();
      const meta = await b.inference.getServiceMetadata(providerAddr);
      return {
        endpoint: meta.endpoint,
        model: meta.model,
        async headersFor(content) {
          const h = await b.inference.getRequestHeaders(providerAddr, content);
          return h as unknown as Record<string, string>;
        },
        async verify(chatId, content) {
          return Boolean(await b.inference.processResponse(providerAddr, chatId, content));
        },
      };
    },
  };
}

export { parseEther };
