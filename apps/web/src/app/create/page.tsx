import { CreateBrainClient } from './create-client';

export const metadata = {
  title: 'Create a brain · Icaruz',
  description: 'Upload knowledge, set a payout wallet, publish a specialist brain.',
};

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-10">
        <div className="label-rail mb-2">publish</div>
        <h1 className="font-display text-4xl text-[var(--ink)]">create a brain</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--ink-dim)]">
          Upload your knowledge, set a wallet and per-query price. Agents pay you via x402 when
          your brain answers.
        </p>
      </header>
      <CreateBrainClient />
    </main>
  );
}
