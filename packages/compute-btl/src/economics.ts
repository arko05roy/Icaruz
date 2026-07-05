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

export function parseBtlHeaders(headers: Headers): BtlEconomics {
  const cacheTier = headers.get('x-btl-cache-tier');
  const saved = parseMoney(headers.get('x-btl-saved'));
  return {
    requestId: headers.get('x-btl-request-id'),
    cacheTier,
    benchmarkCost: parseMoney(headers.get('x-btl-benchmark-cost')),
    customerCharge: parseMoney(headers.get('x-btl-customer-charge')),
    saved,
    cacheHit: Boolean(cacheTier && cacheTier !== 'miss' && cacheTier !== 'none'),
  };
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
