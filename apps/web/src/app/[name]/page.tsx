import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LOCAL_BRAINS } from '@/lib/brain-registry';
import { BrainQuery } from '@/components/brain-query';

interface BrainPageProps {
  params: Promise<{ name: string }>;
}

export const dynamic = 'force-dynamic';

export default async function BrainPage({ params }: BrainPageProps) {
  const { name } = await params;
  const brain = LOCAL_BRAINS.find((b) => b.id === name || b.name === name);
  if (!brain) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/brains" className="label-rail hover:text-[var(--ink)]">
        ← catalog
      </Link>

      <header className="mt-6 flex flex-col gap-3">
        <h1 className="font-display text-4xl text-[var(--ink)]">{brain.name}</h1>
        <p className="text-sm text-[var(--ink-dim)]">{brain.specialty}</p>
      </header>

      <section className="mt-8 grid gap-px bg-[var(--ridge)] sm:grid-cols-2">
        <Stat label="target id" value={brain.target} />
        <Stat label="topics" value={brain.topics.join(' · ')} />
        <Stat label="inference" value="BTL Runtime" />
        <Stat label="prompt shape" value="prefix-stable RAG" />
      </section>

      <section className="mt-10">
        <BrainQuery brainName={brain.name} target={brain.target} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--panel)] p-4">
      <div className="label-rail">{label}</div>
      <div className="mt-2 font-data text-sm text-[var(--ink)]">{value}</div>
    </div>
  );
}
