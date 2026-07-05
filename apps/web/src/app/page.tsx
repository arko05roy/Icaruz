import Link from 'next/link';
import { MixtureDemo } from '@/components/mixture-demo';
import { BtlFanoutViz } from '@/components/btl-fanout-viz';
import { LOCAL_BRAINS } from '@/lib/brain-registry';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
      {/* HERO — thesis first: cache economics, not blockchain */}
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-live">btl hackathon</span>
            <span className="chip">cache-aware mixture</span>
            <span className="chip">prefix-stable RAG</span>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,8vw,4.5rem)] leading-[0.95] text-[var(--ink)]">
            expert networks
            <br />
            <span className="text-[var(--signal)]">shouldn&apos;t</span>
            <br />
            rebill context
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[var(--ink-dim)]">
            Brainpedia fans a single agent prompt across specialist knowledge brains.
            Each brain sends the same wiki prefix with a different question tail — so{' '}
            <strong className="font-medium text-[var(--mint)]">BTL Runtime</strong> can
            cache, dedupe, and prove savings on every call via{' '}
            <code className="font-data text-xs text-[var(--ice)]">x-btl-*</code> headers.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="#demo" className="btn-signal">
              run live demo
            </a>
            <a
              href="https://runtime.badtheorylabs.com/"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              btl runtime ↗
            </a>
          </div>
        </div>

        <div className="panel-raised p-5">
          <div className="label-rail mb-3">why judges should care</div>
          <ul className="flex flex-col gap-4 text-sm text-[var(--ink-dim)]">
            <li className="flex gap-3">
              <span className="font-data text-[var(--signal)]">01</span>
              <span>
                Not a base-URL swap — we <em>structure prompts</em> for prefix cache on
                repeated wiki context across mixture fan-out.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-data text-[var(--signal)]">02</span>
              <span>
                <code className="font-data text-xs">POST /api/mixture</code> returns a
                full economics ledger: benchmark, charge, saved, cache tier per brain.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-data text-[var(--signal)]">03</span>
              <span>
                Re-run the same prompt — watch{' '}
                <code className="font-data text-xs text-[var(--mint)]">cacheHits</code>{' '}
                climb. Verifiable in the UI, not a spreadsheet.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ARCHITECTURE — how BTL fits */}
      <section className="mt-20 grid gap-8 lg:grid-cols-2">
        <BtlFanoutViz brainCount={LOCAL_BRAINS.length} />
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-3xl text-[var(--ink)]">how it routes</h2>
          <p className="text-sm leading-relaxed text-[var(--ink-dim)]">
            Agent prompt hits the orchestrator. Cheap{' '}
            <code className="font-data text-xs">BTL_ROUTER_MODEL</code> picks a topic.
            N brains answer in parallel with identical context blocks (stable prefix).
            Synthesis fuses answers through BTL again. Every hop emits savings headers.
          </p>
          <div className="panel divide-y divide-[var(--ridge)] text-sm">
            <Row k="gateway" v="api.badtheorylabs.com/v1" />
            <Row k="package" v="@brainpedia/compute-btl" />
            <Row k="endpoint" v="POST /api/mixture" />
            <Row k="brains" v={`${LOCAL_BRAINS.length} local specialists`} />
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="mt-24 scroll-mt-20">
        <MixtureDemo />
      </section>

      {/* INTEGRATION SNIPPET */}
      <section className="mt-24">
        <h2 className="font-display mb-4 text-3xl text-[var(--ink)]">integration</h2>
        <p className="mb-4 max-w-2xl text-sm text-[var(--ink-dim)]">
          One env var. Same OpenAI SDK. BTL handles routing, cache, dedupe, and per-request
          economics proof.
        </p>
        <pre className="panel overflow-x-auto p-5 font-data text-xs leading-relaxed text-[var(--mint)]">
          {`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: "https://api.badtheorylabs.com/v1",
});

// Brain handler uses prefix-stable RAG:
//   system (static) + context block (stable) + question (volatile)
const res = await client.chat.completions.create({ ... });
// res.headers → x-btl-saved, x-btl-cache-tier, x-btl-customer-charge`}
        </pre>
      </section>

      {/* BRAINS GRID */}
      <section className="mt-24">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl text-[var(--ink)]">specialist brains</h2>
          <Link href="/brains" className="label-rail hover:text-[var(--ink)]">
            view all →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {LOCAL_BRAINS.map((b) => (
            <Link
              key={b.id}
              href={`/${b.id}`}
              className="panel group p-5 transition-colors hover:border-[var(--ridge-bright)]"
            >
              <div className="font-data text-sm text-[var(--signal)]">{b.name}</div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-dim)] group-hover:text-[var(--ink)]">
                {b.specialty}
              </p>
              <p className="mt-3 font-data text-[10px] text-[var(--ink-ghost)]">
                topics: {b.topics.join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-[var(--ridge)] pt-8">
        <p className="font-data text-[10px] uppercase tracking-widest text-[var(--ink-ghost)]">
          Brainpedia × BTL Runtime hackathon build · inference economics over blockchain
        </p>
      </footer>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="label-rail">{k}</span>
      <span className="font-data text-xs text-[var(--ink)]">{v}</span>
    </div>
  );
}
