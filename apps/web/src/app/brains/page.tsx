import Link from 'next/link';
import { LOCAL_BRAINS, DISCOVERY_TOPICS } from '@/lib/brain-registry';

export default function BrainsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-10">
        <div className="label-rail mb-2">catalog</div>
        <h1 className="font-display text-4xl text-[var(--ink)]">specialist brains</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--ink-dim)]">
          Local registry for the BTL hackathon build — no ENS, no chain. Each brain is a
          prefix-stable RAG endpoint the mixture orchestrator fans out to.
        </p>
      </header>

      <section className="mb-12">
        <div className="label-rail mb-3">discovery topics</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {DISCOVERY_TOPICS.map((t) => (
            <div key={t.topic} className="panel p-4">
              <div className="font-data text-sm text-[var(--signal)]">{t.topic}</div>
              <p className="mt-2 text-xs text-[var(--ink-dim)]">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="label-rail mb-3">brains</div>
        <div className="flex flex-col gap-2">
          {LOCAL_BRAINS.map((b) => (
            <Link
              key={b.id}
              href={`/${b.id}`}
              className="panel flex flex-col gap-2 p-5 transition-colors hover:border-[var(--ridge-bright)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-data text-base text-[var(--ink)]">{b.name}</div>
                <p className="mt-1 text-sm text-[var(--ink-dim)]">{b.specialty}</p>
              </div>
              <div className="font-data text-[10px] text-[var(--ink-ghost)]">
                target={b.target} · {b.topics.join(', ')}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
