import type { BtlConfig } from './config.js';

export interface BtlQuoteResult {
  ok: boolean;
  benchmarkCost?: number;
  customerCharge?: number;
  saved?: number;
  cacheTier?: string;
  model?: string;
  error?: string;
}

/**
 * Dry-run economics for a payload via BTL's quote route (when available).
 * Falls back gracefully so the hackathon demo still works if quote 404s.
 */
export async function quoteBtlRequest(
  cfg: BtlConfig,
  body: { model: string; messages: Array<{ role: string; content: string }> },
): Promise<BtlQuoteResult> {
  const url = cfg.baseUrl.replace(/\/v1$/, '') + '/v1/account/quote';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `quote HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      benchmarkCost: num(data.benchmark_cost ?? data.benchmarkCost),
      customerCharge: num(data.customer_charge ?? data.customerCharge),
      saved: num(data.saved),
      cacheTier: str(data.cache_tier ?? data.cacheTier),
      model: str(data.model) ?? body.model,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}
