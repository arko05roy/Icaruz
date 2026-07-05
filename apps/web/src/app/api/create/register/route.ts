/**
 * POST /api/create/register
 *
 * Compile uploaded knowledge, save a local snapshot, optionally upload to 0G,
 * and register the brain in the dynamic catalog (wallet + price, no iNFT).
 */
import { NextResponse } from 'next/server';
import {
  compileKnowledge,
  createComputeCompiler,
  deterministicCompiler,
} from '@brainpedia/knowledge-compiler';
import { createBrainLogClient, loadZgConfig } from '@brainpedia/storage-0g';
import { isAddress } from 'viem';
import { localStorageRoot, registerCreatorBrain } from '@/lib/brain-store';

export const maxDuration = 120;
export const runtime = 'nodejs';

const TOPIC_RE = /^[a-z0-9_-]{1,32}$/;

function parseTopics(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((t) =>
          t
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32),
        )
        .filter((t) => TOPIC_RE.test(t)),
    ),
  ];
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const ownerRaw = form.get('owner');
    if (typeof ownerRaw !== 'string' || !isAddress(ownerRaw)) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid owner wallet.' }, { status: 400 });
    }
    const owner = ownerRaw as `0x${string}`;

    const payoutRaw = form.get('payoutWallet');
    const payoutWallet =
      typeof payoutRaw === 'string' && isAddress(payoutRaw) ? payoutRaw : owner;

    const name = (form.get('name') ?? '').toString().trim();
    const specialty = (form.get('specialty') ?? '').toString().trim() || name;
    const priceRaw = (form.get('priceUsd') ?? '0.01').toString();
    const priceUsd = Number(priceRaw);
    const topicsRaw = (form.get('topics') ?? 'all').toString();
    const topics = parseTopics(topicsRaw);

    const fileEntries = form.getAll('files').filter((f): f is File => f instanceof File);
    if (fileEntries.length === 0) {
      return NextResponse.json({ ok: false, error: 'No files uploaded.' }, { status: 400 });
    }

    const TOTAL_LIMIT = 25 * 1024 * 1024;
    let totalBytes = 0;
    const inputFiles = [];
    for (const file of fileEntries) {
      totalBytes += file.size;
      if (totalBytes > TOTAL_LIMIT) {
        return NextResponse.json({ ok: false, error: `Total upload exceeds ${TOTAL_LIMIT} bytes.` }, { status: 413 });
      }
      inputFiles.push({
        path: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type || undefined,
      });
    }

    const compileMode = new URL(req.url).searchParams.get('compile') ?? 'deterministic';
    let compiler = deterministicCompiler;
    if (compileMode === 'tee' || compileMode === 'compute' || compileMode === '0g') {
      compiler = createComputeCompiler();
    }

    const compiled = await compileKnowledge(inputFiles, { compiler });
    if (compiled.articles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No articles produced. Upload markdown, plain text, PDF, or DOCX with content.',
          unsupported: compiled.unsupported,
          failed: compiled.failed,
        },
        { status: 422 },
      );
    }

    const articleRecords = compiled.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      body: a.body,
      links: a.links,
      sources: a.sources,
      updatedAt: a.updatedAt,
    }));

    let storageRoot = '';
    let storageUploadTx: string | undefined;

    const signerKey = process.env.ZG_WALLET_PRIVATE_KEY?.trim();
    if (signerKey) {
      try {
        const zgConfig = loadZgConfig();
        const logClient = createBrainLogClient(zgConfig, signerKey);
        const snapshot = await logClient.uploadSnapshot(owner, articleRecords, null);
        storageRoot = snapshot.rootHash;
        storageUploadTx = snapshot.txHash;
      } catch (err) {
        console.warn('[api/create/register] 0G upload failed, using local snapshot:', err);
      }
    }

    const record = await registerCreatorBrain({
      name: name || specialty.slice(0, 32),
      specialty,
      topics: topics.length > 0 ? topics : ['all'],
      storageRoot: storageRoot || 'local:pending',
      payoutWallet,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0.01,
      ownerWallet: owner,
      articles: articleRecords,
    });

    return NextResponse.json({
      ok: true,
      brain: record,
      storageRoot: record.storageRoot,
      storageUploadTx,
      articleCount: compiled.articles.length,
      catalogUrl: `/brains`,
      brainUrl: `/${record.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/create/register]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
