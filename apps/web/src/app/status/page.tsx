import Link from 'next/link';
import { isBtlConfigured } from '@brainpedia/compute-btl';
import { isBrainRuntimeConfigured } from '@/lib/brain-runtime';

export const dynamic = 'force-dynamic';

export default function StatusPage() {
  const btl = isBtlConfigured();
  const brain = isBrainRuntimeConfigured();

  const checks = [
    { name: 'GATEWAY_API_KEY', ok: btl },
    { name: 'brain runtime (in-process)', ok: brain },
    { name: 'BRAIN_STORAGE_ROOT', ok: Boolean(process.env.BRAIN_STORAGE_ROOT) },
    { name: 'BRAIN_ENS_NAME', ok: Boolean(process.env.BRAIN_ENS_NAME) },
    { name: 'BRAIN_SPECIALTY', ok: Boolean(process.env.BRAIN_SPECIALTY) },
  ];

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="label-rail mb-2">health</div>
      <h1 className="font-display text-3xl text-[var(--ink)]">runtime status</h1>
      <p className="mt-2 text-sm text-[var(--ink-dim)]">
        Server configuration for the ask runtime. Brain queries run in-process via Next.js API
        routes — no separate brain service required.
      </p>

      <ul className="mt-8 flex flex-col gap-2">
        {checks.map((c) => (
          <li
            key={c.name}
            className="panel flex items-center justify-between px-4 py-3 font-data text-sm"
          >
            <span className="text-[var(--ink-dim)]">{c.name}</span>
            <span className={c.ok ? 'stat-mint' : 'stat-hot'}>{c.ok ? 'ok' : 'missing'}</span>
          </li>
        ))}
      </ul>

      <Link href="/ask" className="btn-signal mt-8 inline-block">
        open ask
      </Link>
    </main>
  );
}
