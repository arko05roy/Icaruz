import { parseEther } from 'viem';

/**
 * Parse a brain.price_query ENS text record into a wei bigint. The record
 * is intended to be human-readable (e.g., "0.001 OG"), but for backwards
 * compatibility we also accept:
 *   - "0.001"       → treated as OG decimal
 *   - "0.001 OG"    → canonical
 *   - "0.001OG"     → no-space variant
 *   - "1000000000000000"  → legacy raw wei integer (any integer ≥10 digits)
 *
 * Returns null when the value is missing, empty, or unparseable. The caller
 * should treat null as "no advertised price" (typically: free / not billed).
 *
 * OG on the 0G Galileo testnet uses 18 decimals — same convention as ETH.
 */
export function parsePriceQuery(record: string | undefined | null): bigint | null {
  if (!record) return null;
  const s = record.trim();
  if (!s) return null;

  // "0.001 OG" or "0.001OG" — strip the unit and parse as OG decimal.
  const ogMatch = /^([0-9]+(?:\.[0-9]+)?|\.[0-9]+)\s*og$/i.exec(s);
  if (ogMatch) {
    return safeParseEther(ogMatch[1]!);
  }

  // Pure number with decimal point → OG.
  if (/^[0-9]*\.[0-9]+$/.test(s) || /^[0-9]+\.[0-9]*$/.test(s)) {
    return safeParseEther(s);
  }

  // Pure integer. Disambiguate: short integers (<10 digits, i.e. < 1 gwei)
  // are clearly OG amounts; long integers are legacy wei.
  if (/^[0-9]+$/.test(s)) {
    if (s.length >= 10) return BigInt(s);
    return safeParseEther(s);
  }

  return null;
}

function safeParseEther(value: string): bigint | null {
  try {
    return parseEther(value);
  } catch {
    return null;
  }
}

/**
 * Format a wei bigint as the canonical brain.price_query record value:
 * `"<decimal> OG"`, with trailing zeros trimmed so the record stays compact
 * and human-readable. Examples:
 *   1000000000000000n  → "0.001 OG"
 *   500000000000000000n → "0.5 OG"
 *   1000000000000000000n → "1 OG"
 */
export function formatPriceQuery(wei: bigint): string {
  if (wei < 0n) throw new Error('formatPriceQuery: negative wei');
  const ether = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return `${ether} OG`;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${ether}.${fracStr} OG`;
}
