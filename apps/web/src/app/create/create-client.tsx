'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from 'wagmi';
import { ZG_EXPLORER_URL, ZG_MAINNET_ID, ZG_MAINNET_RPC } from '@/lib/wagmi';

interface CompiledArticleSummary {
  slug: string;
  title: string;
  linkCount: number;
  bodyChars: number;
  sources: string[];
}

interface CompileResponse {
  ok: boolean;
  step?: 'preview' | 'finalize';
  rootHash?: `0x${string}`;
  articleCount?: number;
  articles?: CompiledArticleSummary[];
  formatBreakdown?: Record<string, number>;
  unsupported?: Array<{ path: string; reason: string }>;
  failed?: Array<{ path: string; error: string }>;
  storageUploadTx?: string;
  error?: string;
}

type FlowState =
  | 'idle'                  // user has not previewed yet
  | 'previewing'            // POST ?step=preview in flight
  | 'previewed'             // server returned article preview; awaiting user confirm
  | 'finalizing'            // POST ?step=finalize in flight (uploading to 0G Storage)
  | 'ready-to-mint'         // server returned rootHash; user can sign
  | 'error';                // either phase failed

// Minimal BrainMinter ABI for mintToSender. Public-only Brain — encryptedURI
// and sealedKey are empty, metadataHash is zero. The server-uploaded snapshot
// merkle root goes in as initialStorageRoot.
const MINTER_ABI = [
  {
    type: 'function',
    name: 'mintToSender',
    stateMutability: 'payable',
    inputs: [
      { name: 'initialStorageRoot', type: 'bytes32' },
      { name: 'encryptedURI', type: 'bytes' },
      { name: 'metadataHash', type: 'bytes32' },
      { name: 'description', type: 'string' },
      { name: 'sealedKey', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export function CreateBrainClient({ minterAddress }: { minterAddress: `0x${string}` }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isMinting } = useWriteContract();

  const [hydrated, setHydrated] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [previewResult, setPreviewResult] = useState<CompileResponse | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<CompileResponse | null>(null);
  const [mintHash, setMintHash] = useState<`0x${string}` | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Avoid SSR hydration mismatches — wagmi state is undefined on the server.
  useEffect(() => setHydrated(true), []);

  const onChainCorrect = chainId === ZG_MAINNET_ID;
  // wagmi v2 EIP-6963 discovery surfaces every injected wallet (MetaMask,
  // Phantom's EVM shim, the generic "Injected", etc). This flow is
  // MetaMask-only, so show exactly one button: the EIP-6963 MetaMask
  // connector if it announced (id "io.metamask" / name contains
  // "metamask"), otherwise fall back to the base injected connector
  // (covers the case where MetaMask is the only wallet but did not
  // announce via EIP-6963). Never show Phantom or the bare Injected
  // when MetaMask is present.
  const metaMaskConnector = useMemo(() => {
    const isMetaMask = (c: (typeof connectors)[number]) =>
      c.id.toLowerCase() === 'io.metamask' || /meta\s*mask/i.test(c.name);
    return (
      connectors.find(isMetaMask) ??
      connectors.find((c) => c.id === 'injected') ??
      null
    );
  }, [connectors]);

  const onAddOrSwitchChain = useCallback(async () => {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: ZG_MAINNET_ID });
    } catch (err) {
      // wagmi/viem returns code 4902 for "chain not yet added". Try
      // wallet_addEthereumChain directly as a fallback so users don't have
      // to add 0G Aristotle to MetaMask manually.
      const eth = (window as { ethereum?: { request?: (a: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
      if (eth?.request) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${ZG_MAINNET_ID.toString(16)}`,
                chainName: '0G Aristotle',
                nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
                rpcUrls: [ZG_MAINNET_RPC],
                blockExplorerUrls: [ZG_EXPLORER_URL],
              },
            ],
          });
          return;
        } catch (addErr) {
          setSwitchError(addErr instanceof Error ? addErr.message : String(addErr));
          return;
        }
      }
      setSwitchError(err instanceof Error ? err.message : String(err));
    }
  }, [switchChainAsync]);

  const resetFlow = useCallback(() => {
    setFlowState('idle');
    setPreviewResult(null);
    setFinalizeResult(null);
    setMintHash(null);
    setMintError(null);
  }, []);

  const onPickFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked) return;
      setFiles(Array.from(picked));
      resetFlow();
    },
    [resetFlow],
  );

  const onDrop = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      const dropped = Array.from(ev.dataTransfer.files);
      if (dropped.length === 0) return;
      setFiles(dropped);
      resetFlow();
    },
    [resetFlow],
  );

  // Step 1: preview compilation (no storage upload)
  const onPreview = useCallback(async () => {
    if (!address || files.length === 0) return;
    setFlowState('previewing');
    setPreviewResult(null);
    setFinalizeResult(null);
    setMintError(null);
    try {
      const fd = new FormData();
      fd.append('owner', address);
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/create?step=preview', { method: 'POST', body: fd });
      const body: CompileResponse = await res.json();
      setPreviewResult(body);
      setFlowState(body.ok ? 'previewed' : 'error');
    } catch (err) {
      setPreviewResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setFlowState('error');
    }
  }, [address, files]);

  // Step 2: user confirms — upload snapshot to 0G Storage
  const onFinalize = useCallback(async () => {
    if (!address || files.length === 0) return;
    setFlowState('finalizing');
    setFinalizeResult(null);
    setMintError(null);
    try {
      const fd = new FormData();
      fd.append('owner', address);
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/create?step=finalize', { method: 'POST', body: fd });
      const body: CompileResponse = await res.json();
      setFinalizeResult(body);
      setFlowState(body.ok && body.rootHash ? 'ready-to-mint' : 'error');
    } catch (err) {
      setFinalizeResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setFlowState('error');
    }
  }, [address, files]);

  // Step 3: sign the mint transaction
  const onMint = useCallback(async () => {
    if (!finalizeResult?.rootHash) return;
    setMintError(null);
    try {
      if (!onChainCorrect) {
        await onAddOrSwitchChain();
      }
      const hash = await writeContractAsync({
        address: minterAddress,
        abi: MINTER_ABI,
        functionName: 'mintToSender',
        args: [
          finalizeResult.rootHash,
          '0x' as `0x${string}`,
          ZERO_BYTES32,
          description.trim() || 'Brain created via brainpedia.up.railway.app',
          '0x' as `0x${string}`,
        ],
        value: 0n,
      });
      setMintHash(hash);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : String(err));
    }
  }, [finalizeResult, description, minterAddress, onChainCorrect, onAddOrSwitchChain, writeContractAsync]);

  return (
    <section className="flex flex-col gap-6">
      {/* Wallet block */}
      <div className="rounded-lg border border-current/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="text-[var(--muted)]">wallet</div>
            <div className="font-mono">
              {hydrated && isConnected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : 'not connected'}
            </div>
            {hydrated && isConnected && (
              <div className="mt-1 text-xs text-[var(--muted)]">
                on chain {chainId ?? '?'} {onChainCorrect ? '(0G Aristotle ✓)' : '(wrong network)'}
              </div>
            )}
          </div>
          {hydrated && !isConnected ? (
            <div className="flex flex-wrap justify-end gap-2">
              {metaMaskConnector ? (
                <button
                  className="rounded border border-current/20 px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  disabled={isConnecting}
                  onClick={() => connect({ connector: metaMaskConnector })}
                >
                  {isConnecting ? 'connecting…' : 'connect MetaMask'}
                </button>
              ) : (
                <span className="text-xs text-[var(--muted)]">MetaMask not detected</span>
              )}
            </div>
          ) : hydrated ? (
            <button
              className="rounded border border-current/20 px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => disconnect()}
            >
              disconnect
            </button>
          ) : null}
        </div>

        {/* No-MetaMask hint */}
        {hydrated && !metaMaskConnector && !isConnected && (
          <div className="mt-3 text-xs text-[var(--muted)]">
            MetaMask not detected. Install the MetaMask extension and refresh, or use the{' '}
            <a className="underline" href="https://www.npmjs.com/package/brainpedia-mcp" target="_blank" rel="noreferrer">
              brainpedia-mcp
            </a>{' '}
            Claude Code path instead.
          </div>
        )}

        {/* Connect error */}
        {connectError && (
          <div className="mt-3 text-xs text-red-500 dark:text-red-400 break-words">
            connect failed: {connectError.message}
          </div>
        )}

        {/* Wrong-chain prompt */}
        {hydrated && isConnected && !onChainCorrect && (
          <div className="mt-3 flex flex-col gap-2 text-sm text-amber-600 dark:text-amber-400">
            <div className="flex items-center justify-between gap-3">
              <span>Wrong network. Brainpedia mints on 0G Aristotle (chainId {ZG_MAINNET_ID}).</span>
              <button
                className="rounded border border-current/30 px-2 py-1 text-xs hover:bg-amber-100/30"
                onClick={onAddOrSwitchChain}
              >
                add / switch to 0G Aristotle
              </button>
            </div>
            {switchError && (
              <div className="text-xs text-red-500 dark:text-red-400 break-words">
                switch failed: {switchError}. Open MetaMask, add a custom network with chainId 16661, RPC{' '}
                <code>{ZG_MAINNET_RPC}</code>, currency symbol 0G, explorer <code>{ZG_EXPLORER_URL}</code>.
              </div>
            )}
          </div>
        )}
      </div>

      {/* File picker / drop zone */}
      <div
        className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-current/20 p-6 text-center"
        onDrop={onDrop}
        onDragOver={(ev) => ev.preventDefault()}
      >
        <p className="text-sm">
          Drop a folder of files here, or pick them manually. Markdown, plain
          text, PDF, and Word are supported.
        </p>
        <input
          type="file"
          multiple
          accept=".md,.markdown,.txt,.text,.pdf,.docx"
          onChange={(ev) => onPickFiles(ev.target.files)}
          className="mx-auto block max-w-md text-sm"
        />
        {files.length > 0 && (
          <ul className="mx-auto max-w-md text-left text-xs text-[var(--muted)]">
            {files.map((f) => (
              <li key={f.name + f.size} className="truncate">
                {f.name} ({Math.ceil(f.size / 1024)} KB)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wider text-[var(--muted)]" htmlFor="desc">
          Brain description (optional)
        </label>
        <input
          id="desc"
          type="text"
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          placeholder="e.g. AI x Web3 protocol design notes"
          className="rounded border border-current/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {/* === Step 1: PREVIEW button (no storage upload yet) === */}
      {flowState !== 'finalizing' && flowState !== 'ready-to-mint' && (
        <button
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          disabled={!isConnected || files.length === 0 || flowState === 'previewing'}
          onClick={onPreview}
        >
          {flowState === 'previewing'
            ? 'extracting + compiling…'
            : flowState === 'previewed'
              ? 'recompile (input changed?)'
              : '1. preview compilation'}
        </button>
      )}

      {/* Preview / finalize errors */}
      {flowState === 'error' && previewResult && !previewResult.ok && (
        <div className="rounded border border-red-300/30 bg-red-50/30 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <div className="font-medium">preview failed</div>
          <div className="font-mono text-xs break-all">{previewResult.error}</div>
        </div>
      )}
      {flowState === 'error' && finalizeResult && !finalizeResult.ok && (
        <div className="rounded border border-red-300/30 bg-red-50/30 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <div className="font-medium">upload failed</div>
          <div className="font-mono text-xs break-all">{finalizeResult.error}</div>
        </div>
      )}

      {/* === Step 2 result panel: preview compiled articles + confirm === */}
      {(flowState === 'previewed' || flowState === 'finalizing' || flowState === 'ready-to-mint') &&
        previewResult?.ok && (
          <div className="flex flex-col gap-4 rounded-lg border border-current/10 p-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-[var(--muted)]">articles compiled:</span>{' '}
                <span className="font-mono">{previewResult.articleCount}</span>
              </span>
              {previewResult.formatBreakdown && (
                <span className="text-xs text-[var(--muted)]">
                  ({Object.entries(previewResult.formatBreakdown)
                    .filter(([, n]) => (n as number) > 0)
                    .map(([k, n]) => `${k}=${n}`)
                    .join(' · ')})
                </span>
              )}
            </div>

            <ul className="flex max-h-72 flex-col gap-1 overflow-auto text-xs">
              {previewResult.articles?.map((a) => (
                <li key={a.slug} className="font-mono">
                  <span className="text-[var(--muted)]">{a.slug}</span> · {a.title} · {a.bodyChars} chars · {a.linkCount} link
                  {a.linkCount === 1 ? '' : 's'}
                </li>
              ))}
            </ul>

            {previewResult.unsupported && previewResult.unsupported.length > 0 && (
              <div className="text-xs text-[var(--muted)]">
                Skipped (unsupported): {previewResult.unsupported.map((u) => u.path).join(', ')}
              </div>
            )}

            {/* Confirm panel (before upload) */}
            {flowState === 'previewed' && (
              <div className="flex flex-col gap-3 rounded border border-amber-300/30 bg-amber-50/20 p-3 text-sm dark:bg-amber-900/10">
                <p className="text-[var(--muted)]">
                  Nothing has been uploaded yet. Review the article list above. If anything looks off,
                  change your files (or the description) and click <em>recompile</em>. When you&apos;re happy,
                  the next step uploads the snapshot to 0G Storage on chain.
                </p>
                <button
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  disabled={!isConnected}
                  onClick={onFinalize}
                >
                  2. looks good — upload to 0G Storage
                </button>
              </div>
            )}

            {/* Finalizing state */}
            {flowState === 'finalizing' && (
              <div className="rounded border border-current/10 bg-black/[0.02] p-3 text-sm text-[var(--muted)] dark:bg-white/[0.02]">
                uploading snapshot to 0G Storage Log layer… this is the on-chain step (~10s).
              </div>
            )}

            {/* Ready-to-mint panel */}
            {flowState === 'ready-to-mint' && finalizeResult?.rootHash && (
              <div className="flex flex-col gap-3 rounded border border-emerald-300/30 bg-emerald-50/20 p-3 text-sm dark:bg-emerald-900/10">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>
                    <span className="text-[var(--muted)]">storage root:</span>{' '}
                    <span className="font-mono">
                      {finalizeResult.rootHash.slice(0, 10)}…{finalizeResult.rootHash.slice(-6)}
                    </span>
                  </span>
                  {finalizeResult.storageUploadTx && (
                    <a
                      href={`${ZG_EXPLORER_URL}/tx/${finalizeResult.storageUploadTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      storage upload tx ↗
                    </a>
                  )}
                </div>
                <button
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  disabled={!isConnected || isMinting}
                  onClick={onMint}
                >
                  {isMinting ? 'sign mint in wallet…' : '3. sign mint transaction'}
                </button>
              </div>
            )}
          </div>
        )}

      {mintError && (
        <div className="rounded border border-red-300/30 bg-red-50/30 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <div className="font-medium">mint failed</div>
          <div className="font-mono text-xs break-all">{mintError}</div>
        </div>
      )}

      {mintHash && (
        <div className="rounded border border-emerald-300/30 bg-emerald-50/30 p-4 text-sm dark:bg-emerald-900/20">
          <div className="font-medium">Brain minted</div>
          <a
            className="font-mono text-xs underline break-all"
            href={`${ZG_EXPLORER_URL}/tx/${mintHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {mintHash}
          </a>
        </div>
      )}
    </section>
  );
}
