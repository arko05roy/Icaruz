'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import Link from 'next/link';

interface CompiledArticleSummary {
  slug: string;
  title: string;
  linkCount: number;
  bodyChars: number;
  sources: string[];
}

interface PreviewResponse {
  ok: boolean;
  step?: 'preview';
  articleCount?: number;
  articles?: CompiledArticleSummary[];
  formatBreakdown?: Record<string, number>;
  unsupported?: Array<{ path: string; reason: string }>;
  failed?: Array<{ path: string; error: string }>;
  error?: string;
}

interface RegisterResponse {
  ok: boolean;
  brain?: { id: string; name: string; priceUsd: number; payoutWallet: string };
  brainUrl?: string;
  storageRoot?: string;
  articleCount?: number;
  error?: string;
}

type FlowState =
  | 'idle'
  | 'previewing'
  | 'previewed'
  | 'publishing'
  | 'published'
  | 'error';

const TOPICS = ['research', 'frameworks', 'all'] as const;

export function CreateBrainClient() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [hydrated, setHydrated] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [priceUsd, setPriceUsd] = useState('0.01');
  const [topics, setTopics] = useState<string[]>(['all']);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [registerResult, setRegisterResult] = useState<RegisterResponse | null>(null);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (address && !payoutWallet) setPayoutWallet(address);
  }, [address, payoutWallet]);

  const metaMaskConnector = useMemo(() => {
    const isMetaMask = (c: (typeof connectors)[number]) =>
      c.id.toLowerCase() === 'io.metamask' || /meta\s*mask/i.test(c.name);
    return connectors.find(isMetaMask) ?? connectors.find((c) => c.id === 'injected') ?? null;
  }, [connectors]);

  const resetFlow = useCallback(() => {
    setFlowState('idle');
    setPreviewResult(null);
    setRegisterResult(null);
  }, []);

  const onPickFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked) return;
      setFiles(Array.from(picked));
      resetFlow();
    },
    [resetFlow],
  );

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const onPreview = useCallback(async () => {
    if (!address || files.length === 0) return;
    setFlowState('previewing');
    setPreviewResult(null);
    setRegisterResult(null);
    try {
      const fd = new FormData();
      fd.append('owner', address);
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/create?step=preview', { method: 'POST', body: fd });
      const body: PreviewResponse = await res.json();
      setPreviewResult(body);
      setFlowState(body.ok ? 'previewed' : 'error');
    } catch (err) {
      setPreviewResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setFlowState('error');
    }
  }, [address, files]);

  const onPublish = useCallback(async () => {
    if (!address || files.length === 0) return;
    setFlowState('publishing');
    setRegisterResult(null);
    try {
      const fd = new FormData();
      fd.append('owner', address);
      fd.append('payoutWallet', payoutWallet.trim() || address);
      fd.append('name', name.trim() || specialty.trim() || 'my-brain');
      fd.append('specialty', specialty.trim() || name.trim());
      fd.append('priceUsd', priceUsd.trim() || '0.01');
      fd.append('topics', topics.join(','));
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/create/register', { method: 'POST', body: fd });
      const body: RegisterResponse = await res.json();
      setRegisterResult(body);
      setFlowState(body.ok ? 'published' : 'error');
    } catch (err) {
      setRegisterResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setFlowState('error');
    }
  }, [address, files, name, specialty, payoutWallet, priceUsd, topics]);

  return (
    <section className="flex flex-col gap-6">
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="label-rail">payout wallet</div>
            <div className="font-data text-sm">
              {hydrated && isConnected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : 'not connected'}
            </div>
          </div>
          {hydrated && !isConnected ? (
            metaMaskConnector ? (
              <button
                type="button"
                className="btn-signal text-xs"
                disabled={isConnecting}
                onClick={() => connect({ connector: metaMaskConnector })}
              >
                {isConnecting ? 'connecting…' : 'connect wallet'}
              </button>
            ) : (
              <span className="text-xs text-[var(--ink-dim)]">install MetaMask</span>
            )
          ) : hydrated ? (
            <button
              type="button"
              className="panel px-3 py-1 text-xs text-[var(--ink-dim)]"
              onClick={() => disconnect()}
            >
              disconnect
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="panel border-2 border-dashed border-[var(--ridge)] p-6 text-center"
        onDrop={(ev) => {
          ev.preventDefault();
          onPickFiles(ev.dataTransfer.files);
        }}
        onDragOver={(ev) => ev.preventDefault()}
      >
        <p className="text-sm text-[var(--ink-dim)]">
          Drop markdown, PDF, DOCX, or plain text files.
        </p>
        <input
          type="file"
          multiple
          accept=".md,.markdown,.txt,.text,.pdf,.docx"
          onChange={(ev) => onPickFiles(ev.target.files)}
          className="mx-auto mt-3 block max-w-md text-sm"
        />
        {files.length > 0 && (
          <ul className="mx-auto mt-3 max-w-md text-left font-data text-xs text-[var(--ink-ghost)]">
            {files.map((f) => (
              <li key={f.name + f.size} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="brain name" id="brain-name">
          <input
            id="brain-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. defi-auditor"
            className="w-full border-0 bg-transparent font-data text-sm outline-none"
          />
        </Field>
        <Field label="price / query (USD)" id="brain-price">
          <input
            id="brain-price"
            type="number"
            min="0"
            step="0.01"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            className="w-full border-0 bg-transparent font-data text-sm outline-none"
          />
        </Field>
      </div>

      <Field label="specialty" id="brain-specialty">
        <input
          id="brain-specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="What does this brain know?"
          className="w-full border-0 bg-transparent text-sm outline-none"
        />
      </Field>

      <Field label="payout address (optional)" id="payout-wallet">
        <input
          id="payout-wallet"
          value={payoutWallet}
          onChange={(e) => setPayoutWallet(e.target.value)}
          placeholder="0x… defaults to connected wallet"
          className="w-full border-0 bg-transparent font-data text-xs outline-none"
        />
      </Field>

      <div>
        <div className="label-rail mb-2">discovery topics</div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTopic(t)}
              className={`panel px-3 py-1 font-data text-xs ${
                topics.includes(t) ? 'text-[var(--signal)]' : 'text-[var(--ink-ghost)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {flowState !== 'publishing' && flowState !== 'published' && (
        <button
          type="button"
          className="btn-signal"
          disabled={!isConnected || files.length === 0 || flowState === 'previewing'}
          onClick={onPreview}
        >
          {flowState === 'previewing' ? 'compiling…' : '1. preview compilation'}
        </button>
      )}

      {flowState === 'error' && previewResult && !previewResult.ok && (
        <ErrorBox title="preview failed" message={previewResult.error} />
      )}
      {flowState === 'error' && registerResult && !registerResult.ok && (
        <ErrorBox title="publish failed" message={registerResult.error} />
      )}

      {previewResult?.ok && flowState !== 'idle' && flowState !== 'previewing' && (
        <div className="panel flex flex-col gap-4 p-4">
          <div className="font-data text-sm">
            <span className="text-[var(--ink-dim)]">articles:</span> {previewResult.articleCount}
          </div>
          <ul className="max-h-48 overflow-auto font-data text-xs text-[var(--ink-ghost)]">
            {previewResult.articles?.map((a) => (
              <li key={a.slug}>
                {a.slug} · {a.title}
              </li>
            ))}
          </ul>
          {flowState === 'previewed' && (
            <button type="button" className="btn-signal" disabled={!isConnected} onClick={onPublish}>
              2. publish brain
            </button>
          )}
          {flowState === 'publishing' && (
            <p className="text-sm text-[var(--ink-dim)]">compiling + registering…</p>
          )}
        </div>
      )}

      {flowState === 'published' && registerResult?.ok && registerResult.brain && (
        <div className="panel border-l-[3px] border-l-[var(--mint)] p-4">
          <div className="label-rail text-[var(--mint)]">brain published</div>
          <p className="mt-2 text-sm text-[var(--ink)]">
            {registerResult.brain.name} · ${registerResult.brain.priceUsd.toFixed(2)}/query
          </p>
          <Link href={registerResult.brainUrl ?? `/${registerResult.brain.id}`} className="mt-3 inline-block font-data text-sm text-[var(--signal)] underline">
            open brain →
          </Link>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <label htmlFor={id} className="label-rail mb-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message?: string }) {
  return (
    <div className="panel border-l-[3px] border-l-[var(--hot)] p-4">
      <div className="label-rail text-[var(--hot)]">{title}</div>
      <p className="mt-2 font-data text-xs text-[var(--ink)]">{message}</p>
    </div>
  );
}
