import { listAllBrainsForTopic } from '@/lib/brain-registry';
import { listCreatorBrains } from '@/lib/brain-store';

export default async function BrainsPage() {
  const creatorBrains = await listCreatorBrains();
  const allBrains = await listAllBrainsForTopic('all');

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-rail mb-2">catalog</div>
          <h1 className="font-display text-4xl text-[var(--ink)]">specialist brains</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--ink-dim)]">
            Specialist knowledge endpoints the mixture orchestrator fans out to.
          </p>
        </div>
        <a href="/create" className="btn-signal text-sm">
          create brain
        </a>
      </header>

      {creatorBrains.length > 0 && (
        <section className="mb-8 panel border-l-[3px] border-l-[var(--ice)] p-4">
          <div className="label-rail text-[var(--ice)]">creator brains</div>
          <p className="mt-2 text-xs text-[var(--ink-dim)]">
            {creatorBrains.length} published · agents pay via x402 when querying priced brains
          </p>
        </section>
      )}

      <section>
        <div className="label-rail mb-3">brains</div>
        <div className="flex flex-col gap-2">
          {allBrains.map((b) => (
            <a
              key={b.id}
              href={`/${b.id}`}
              className="panel flex flex-col gap-2 p-5 transition-colors hover:border-[var(--ridge-bright)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-data text-base text-[var(--ink)]">{b.name}</span>
                  {b.isCreator && (
                    <span className="font-data text-[9px] uppercase text-[var(--ice)]">creator</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--ink-dim)]">{b.specialty}</p>
              </div>
              <div className="font-data text-[10px] text-[var(--ink-ghost)]">
                {b.priceUsd != null && b.priceUsd > 0 ? `$${b.priceUsd.toFixed(2)}/query · ` : ''}
                {b.topics.join(', ')}
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
