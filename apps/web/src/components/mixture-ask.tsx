'use client';

import { useState } from 'react';
import { BtlFanoutViz } from '@/components/btl-fanout-viz';

interface BtlEconomics {
  requestId: string | null;
  cacheTier: string | null;
  benchmarkCost: number | null;
  customerCharge: number | null;
  saved: number | null;
  cacheHit: boolean;
}

interface BrainRow {
  id: string;
  name: string;
  ok: boolean;
  answer?: string;
  citations?: string[];
  errorMessage?: string;
  btl?: BtlEconomics;
}

interface BtlMixtureResponse {
  topic: string;
  router?: { topic: string; reason: string; source: string };
  brains: BrainRow[];
  synthesis: string;
  synthesisSource: string;
  synthesisBtl?: BtlEconomics;
  btlEconomics: {
    calls: number;
    cacheHits: number;
    totalBenchmarkCost: number;
    totalCustomerCharge: number;
    totalSaved: number;
    savingsRate: number;
    byCacheTier: Record<string, number>;
  };
  creatorEconomics?: {
    brains: Array<{ id: string; name: string; wallet: string | null; priceUsd: number; paid: boolean }>;
    totalUsd: number;
    x402: { endpoint: string; instructions: string };
  };
}

const DEFAULT_PROMPT =
  'What reentrancy patterns should I check first in an ERC-4626 vault audit?';

export function MixtureAsk() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [topic, setTopic] = useState('auto');
  const [response, setResponse] = useState<BtlMixtureResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [history, setHistory] = useState<Array<{ run: number; saved: number; hits: number }>>(
    [],
  );

  const run = async () => {
    if (running || !prompt.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/mixture?topic=${encodeURIComponent(topic)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `mixture returned ${res.status}`);
      }
      const data = (await res.json()) as BtlMixtureResponse;
      setResponse(data);
      const nextRun = runCount + 1;
      setRunCount(nextRun);
      setHistory((h) => [
        {
          run: nextRun,
          saved: data.btlEconomics.totalSaved,
          hits: data.btlEconomics.cacheHits,
        },
        ...h.slice(0, 4),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const econ = response?.btlEconomics;
  const prevHits = history[1]?.hits ?? 0;
  const hitsDelta = econ ? econ.cacheHits - prevHits : 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-[var(--ink)]">Ask</h1>
      </div>

      <div className="panel p-5">
        <label htmlFor="mixture-prompt" className="label-rail mb-2 block">
          question
        </label>
        <textarea
          id="mixture-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={running}
          className="w-full resize-none border-0 bg-transparent font-data text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-ghost)]"
          placeholder="Ask the brain network…"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ridge)] pt-4">
          <div className="flex items-center gap-3">
            <span className="label-rail">topic</span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={running}
              className="panel font-data text-xs text-[var(--ink)] outline-none"
              aria-label="Discovery topic"
            >
              <option value="auto">auto</option>
              <option value="all">all</option>
              <option value="research">research</option>
              <option value="frameworks">frameworks</option>
            </select>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running || !prompt.trim()}
            className="btn-signal"
          >
            {running ? 'routing…' : runCount > 0 ? `re-run #${runCount + 1}` : 'ask'}
          </button>
        </div>
      </div>

      {running && (
        <div className="panel p-4">
          <div className="label-rail mb-3">in flight</div>
          <BtlFanoutViz brainCount={3} />
        </div>
      )}

      {error && (
        <div className="panel border-l-[3px] border-l-[var(--hot)] p-4" role="alert">
          <div className="label-rail text-[var(--hot)]">fault</div>
          <p className="mt-2 font-data text-sm text-[var(--ink)]">{error}</p>
          <p className="mt-2 text-xs text-[var(--ink-dim)]">
            Set <code className="font-data">GATEWAY_API_KEY</code>,{' '}
            <code className="font-data">ZG_WALLET_PRIVATE_KEY</code>, and brain env vars on the
            server.
          </p>
        </div>
      )}

      {response && econ && (
        <div className="flex flex-col gap-5">
          <div className="receipt receipt-enter p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label-rail text-[var(--mint)]">btl economics receipt</div>
                <div className="mt-1 font-data text-[10px] text-[var(--ink-ghost)]">
                  run {runCount} · topic={response.topic}
                  {hitsDelta > 0 && (
                    <span className="ml-2 text-[var(--mint)]">+{hitsDelta} cache hits</span>
                  )}
                </div>
              </div>
              {response.router && (
                <div className="font-data text-[10px] text-[var(--ink-dim)]">
                  router: {response.router.source} → {response.router.topic}
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="benchmark" value={fmtUsd(econ.totalBenchmarkCost)} className="stat-signal" />
              <Metric label="charged" value={fmtUsd(econ.totalCustomerCharge)} className="text-[var(--ink)]" />
              <Metric label="saved" value={fmtUsd(econ.totalSaved)} className="stat-mint" />
              <Metric
                label="cache hits"
                value={`${econ.cacheHits}/${econ.calls}`}
                className={econ.cacheHits > 0 ? 'stat-mint' : 'text-[var(--ink-dim)]'}
              />
            </div>

            <div className="mt-4 font-data text-[10px] text-[var(--ink-ghost)]">
              savings rate {(econ.savingsRate * 100).toFixed(1)}% · tiers{' '}
              {Object.entries(econ.byCacheTier)
                .map(([k, v]) => `${k}:${v}`)
                .join(' · ') || '—'}
            </div>
          </div>

          {response.creatorEconomics && response.creatorEconomics.totalUsd > 0 && (
            <div className="receipt receipt-enter border-l-[3px] border-l-[var(--ice)] p-5">
              <div className="label-rail text-[var(--ice)]">creator royalties (x402)</div>
              <div className="mt-3 font-data text-lg text-[var(--ink)]">
                ${response.creatorEconomics.totalUsd.toFixed(2)}
              </div>
              <p className="mt-2 text-xs text-[var(--ink-dim)]">
                {response.creatorEconomics.brains.filter((b) => b.priceUsd > 0).length} priced brain
                {response.creatorEconomics.brains.filter((b) => b.priceUsd > 0).length === 1 ? '' : 's'}{' '}
                · agents settle per brain via {response.creatorEconomics.x402.endpoint}
              </p>
              <ul className="mt-3 flex flex-col gap-1 font-data text-[10px] text-[var(--ink-ghost)]">
                {response.creatorEconomics.brains
                  .filter((b) => b.priceUsd > 0)
                  .map((b) => (
                    <li key={b.id}>
                      {b.name}: ${b.priceUsd.toFixed(2)}
                      {b.wallet ? ` → ${b.wallet.slice(0, 6)}…${b.wallet.slice(-4)}` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {history.length > 1 && (
            <div className="panel p-4">
              <div className="label-rail mb-3">run history</div>
              <div className="flex flex-col gap-1">
                {history.map((h) => (
                  <div
                    key={h.run}
                    className="flex justify-between font-data text-[10px] text-[var(--ink-dim)]"
                  >
                    <span>run {h.run}</span>
                    <span className="stat-mint">saved {fmtUsd(h.saved)}</span>
                    <span>hits {h.hits}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel border-l-[3px] border-l-[var(--ice)] p-5">
            <div className="label-rail text-[var(--ice)]">synthesis · {response.synthesisSource}</div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">{response.synthesis}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {response.brains.map((b) => (
              <BrainCard key={b.id} brain={b} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <div className="label-rail">{label}</div>
      <div className={`mt-1 font-data text-lg ${className ?? ''}`}>{value}</div>
    </div>
  );
}

function BrainCard({ brain }: { brain: BrainRow }) {
  if (!brain.ok) {
    return (
      <div className="panel border-l-[3px] border-l-[var(--hot)] p-4">
        <div className="font-data text-sm text-[var(--signal)]">{brain.name}</div>
        <p className="mt-2 font-data text-xs text-[var(--hot)]">{brain.errorMessage}</p>
      </div>
    );
  }
  return (
    <article className="panel p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="font-data text-sm text-[var(--signal)]">{brain.name}</span>
        {brain.btl?.cacheTier && (
          <span className="font-data text-[9px] uppercase text-[var(--mint)]">
            {brain.btl.cacheTier}
          </span>
        )}
      </header>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)] line-clamp-5">
        {brain.answer}
      </p>
      {brain.citations && brain.citations.length > 0 && (
        <p className="mt-2 font-data text-[10px] text-[var(--ink-ghost)]">
          cites: {brain.citations.join(', ')}
        </p>
      )}
      {brain.btl && (
        <footer className="mt-3 flex gap-4 font-data text-[10px]">
          <span className="text-[var(--ink-dim)]">{fmtUsd(brain.btl.customerCharge)}</span>
          <span className="stat-mint">−{fmtUsd(brain.btl.saved)}</span>
        </footer>
      )}
    </article>
  );
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '$?';
  return `$${n.toFixed(4)}`;
}
