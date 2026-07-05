/**
 * Brainpedia-specific text record keys (in addition to ENS standards
 * description, avatar, url, com.twitter, com.github, etc.).
 *
 * These keys are how an agent learns where/how to query a Brain after
 * resolving its ENS subname:
 *
 *   - brain.inft           → "<address>:<tokenId>"
 *   - brain.storage_root   → 0G Storage merkle root (current snapshot)
 *   - brain.axl_peer_id    → Ed25519 public key (hex), the peer id
 *   - brain.specialty      → kebab-case specialty
 *   - brain.price_query    → OG decimal with unit, e.g. "0.001 OG"
 *                            (legacy raw-wei strings are still accepted on read)
 *   - brain.compute_url    → 0G Compute provider URL
 */
export const BRAIN_TEXT_KEYS = {
  inft: 'brain.inft',
  storageRoot: 'brain.storage_root',
  axlPeerId: 'brain.axl_peer_id',
  specialty: 'brain.specialty',
  priceQuery: 'brain.price_query',
  computeUrl: 'brain.compute_url',
} as const;

export type BrainTextKey = (typeof BRAIN_TEXT_KEYS)[keyof typeof BRAIN_TEXT_KEYS];

export interface BrainTextRecords {
  description?: string;
  avatar?: string;
  url?: string;
  inft?: string;
  storageRoot?: string;
  axlPeerId?: string;
  specialty?: string;
  priceQuery?: string;
  computeUrl?: string;
}

export interface ResolvedBrain {
  ensName: string;
  owner: `0x${string}` | null;
  records: BrainTextRecords;
}
