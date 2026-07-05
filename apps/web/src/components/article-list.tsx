import type { SampleArticle } from '@/lib/sample-articles';

interface Props {
  articles: SampleArticle[];
  /** Storage root the articles were committed under (for explorer link). */
  storageRoot?: string | null;
}

export function ArticleList({ articles, storageRoot }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-wider text-[var(--muted)]">
          Compiled articles ({articles.length})
        </h2>
        {storageRoot && (
          <p className="font-mono text-xs text-[var(--muted)]">
            <span className="opacity-60">root</span> {storageRoot.slice(0, 10)}…
            {storageRoot.slice(-6)}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {articles.map((a) => (
          <li
            key={a.slug}
            className="rounded-lg border border-current/10 p-4 hover:border-current/20 transition-colors"
          >
            <p className="font-mono text-xs text-[var(--muted)]">{a.slug}</p>
            <h3 className="mt-1 text-base font-medium">{a.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] line-clamp-3">
              {a.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.links.map((linked) => (
                <span
                  key={linked}
                  className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] dark:bg-white/5"
                >
                  → {linked}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
