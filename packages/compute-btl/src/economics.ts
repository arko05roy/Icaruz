/** Per-request economics surfaced by BTL Runtime response headers. */
export interface BtlEconomics {
  requestId: string | null;
  cacheTier: string | null;
  benchmarkCost: number | null;
  customerCharge: number | null;
  saved: number | null;
  /** True when Runtime served from cache (provider call skipped). */
  cacheHit: boolean;
}

export interface BtlEconomicsAggregate {
  calls: number;
  cacheHits: number;
  totalBenchmarkCost: number;
  totalCustomerCharge: number;
  totalSaved: number;
  /** Effective discount vs paying benchmark on every call. */
  savingsRate: number;
  byCacheTier: Record<string, number>;
}

export function parseBtlHeaders(headers: { get(name: string): string | null; forEach?(callback: (value: string, key: string) => void): void }): BtlEconomics {
  const cacheTier = headerGet(headers, 'x-btl-cache-tier');
  const benchmarkCost = parseMoney(headerGet(headers, 'x-btl-benchmark-cost'));
  const customerCharge = parseMoney(headerGet(headers, 'x-btl-customer-charge'));
  const saved = parseMoney(headerGet(headers, 'x-btl-saved'));
  const requestId = headerGet(headers, 'x-btl-request-id');
  const cacheHit = Boolean(
    cacheTier && cacheTier !== 'miss' && cacheTier !== 'none' && cacheTier !== 'unknown',
  );
  return {
    requestId,
    cacheTier,
    benchmarkCost,
    customerCharge,
    // ponytail: some gateways omit x-btl-saved on miss — infer from benchmark − charge.
    saved:
      saved ??
      (benchmarkCost != null && customerCharge != null
        ? Math.max(0, benchmarkCost - customerCharge)
        : null),
    cacheHit,
  };
}

function headerGet(
  headers: { get(name: string): string | null; forEach?(callback: (value: string, key: string) => void): void },
  name: string,
): string | null {
  const direct = headers.get(name);
  if (direct) return direct;
  if (!headers.forEach) return null;
  const lower = name.toLowerCase();
  let found: string | null = null;
  headers.forEach((value, key) => {
    if (key.toLowerCase() === lower) found = value;
  });
  return found;
}

export function aggregateBtlEconomics(rows: BtlEconomics[]): BtlEconomicsAggregate {
  const byCacheTier: Record<string, number> = {};
  let cacheHits = 0;
  let totalBenchmarkCost = 0;
  let totalCustomerCharge = 0;
  let totalSaved = 0;

  for (const row of rows) {
    const tier = row.cacheTier ?? 'unknown';
    byCacheTier[tier] = (byCacheTier[tier] ?? 0) + 1;
    if (row.cacheHit) cacheHits++;
    totalBenchmarkCost += row.benchmarkCost ?? 0;
    totalCustomerCharge += row.customerCharge ?? 0;
    totalSaved += row.saved ?? 0;
  }

  const savingsRate =
    totalBenchmarkCost > 0 ? totalSaved / totalBenchmarkCost : 0;

  return {
    calls: rows.length,
    cacheHits,
    totalBenchmarkCost,
    totalCustomerCharge,
    totalSaved,
    savingsRate,
    byCacheTier,
  };
}

function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
