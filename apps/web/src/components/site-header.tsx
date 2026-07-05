import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--ridge)] bg-[var(--void)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="font-display text-lg text-[var(--ink)]">
          brainpedia
          <span className="text-[var(--signal)]">×</span>
          <span className="text-[var(--mint)]">btl</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link href="/#demo" className="label-rail hover:text-[var(--ink)]">
            live demo
          </Link>
          <Link href="/brains" className="label-rail hover:text-[var(--ink)]">
            brains
          </Link>
          <a
            href="https://runtime.badtheorylabs.com/docs"
            target="_blank"
            rel="noreferrer"
            className="label-rail hover:text-[var(--ink)]"
          >
            btl docs ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
