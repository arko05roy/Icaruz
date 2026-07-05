'use client';

import { useState } from 'react';

interface Props {
  brainName: string;
  target: string;
}

interface BrainResult {
  answer: string;
  citations?: string[];
  btl?: {
    requestId: string | null;
    cacheTier: string | null;
    benchmarkCost: number | null;
    customerCharge: number | null;
    saved: number | null;
    cacheHit: boolean;
  };
}

export function QueryDemo({ brainName, target }: Props) {
  const [prompt, setPrompt] = useState('Summarize your specialty in two sentences.');
  const [result, setResult] = useState<BrainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running || !prompt.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data as BrainResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="label-rail">single-brain query · btl runtime</div>
      <div className="panel p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          disabled={running}
          className="w-full resize-none border-0 bg-transparent font-data text-sm text-[var(--ink)] outline-none"
          aria-label="Query prompt"
        />
        <div className="mt-3 flex justify-end border-t border-[var(--ridge)] pt-3">
          <button type="button" onClick={run} disabled={running} className="btn-signal">
            {running ? 'inferring…' : `query ${brainName}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="panel border-l-[3px] border-l-[var(--hot)] p-4 font-data text-xs text-[var(--hot)]">
          {error}
        </div>
      )}

      {result && (
        <div className="receipt p-5">
          <p className="text-sm leading-relaxed text-[var(--ink)]">{result.answer}</p>
          {result.citations && result.citations.length > 0 && (
            <p className="mt-3 font-data text-[10px] text-[var(--ink-ghost)]">
              cites: {result.citations.join(', ')}
            </p>
          )}
          {result.btl && (
            <div className="mt-4 flex flex-wrap gap-4 font-data text-[10px]">
              <span className="stat-signal">bench ${result.btl.benchmarkCost?.toFixed(4) ?? '?'}</span>
              <span>charge ${result.btl.customerCharge?.toFixed(4) ?? '?'}</span>
              <span className="stat-mint">saved ${result.btl.saved?.toFixed(4) ?? '?'}</span>
              {result.btl.cacheTier && <span>tier {result.btl.cacheTier}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
