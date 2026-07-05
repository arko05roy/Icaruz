/**
 * POST /api/create
 *
 * Two-phase web mint flow. Both phases accept multipart form data with
 * an `owner` address and one or more `files`. The phase is selected via
 * the `step` query param:
 *
 *   ?step=preview   Run extract + compile and return the article preview.
 *                    NO 0G Storage upload happens. The user can inspect the
 *                    compiled wiki and either confirm or change their input.
 *   ?step=finalize  (default) Run extract + compile, AND upload the
 *                    snapshot to 0G Storage via @brainpedia/storage-0g.
 *                    Returns the merkle rootHash + storage upload tx hash.
 *                    The user's wallet then signs BrainMinter.mintToSender.
 *
 * The Brain iNFT itself is minted by the user's wallet on the client side,
 * so the iNFT owner is always the connected user, never the server. The
 * server only pays for the 0G Storage upload, and only in the finalize step.
 */
import { NextResponse } from 'next/server';
import {
  compileKnowledge,
  createComputeCompiler,
  deterministicCompiler,
} from '@brainpedia/knowledge-compiler';
import { createBrainLogClient, loadZgConfig } from '@brainpedia/storage-0g';
import { isAddress } from 'viem';

export const maxDuration = 120;
export const runtime = 'nodejs';

interface ResponsePayload {
  ok: boolean;
  step: 'preview' | 'finalize';
  rootHash?: `0x${string}`;
  articleCount?: number;
  articles?: Array<{
    slug: string;
    title: string;
    linkCount: number;
    bodyChars: number;
    sources: string[];
  }>;
  formatBreakdown?: Record<string, number>;
  unsupported?: Array<{ path: string; reason: string }>;
  failed?: Array<{ path: string; error: string }>;
  storageUploadTx?: string;
  error?: string;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const step = (url.searchParams.get('step') ?? 'finalize') === 'preview' ? 'preview' : 'finalize';
  const compileMode = url.searchParams.get('compile') ?? 'deterministic';

  try {
    const form = await req.formData();
    const ownerRaw = form.get('owner');
    if (typeof ownerRaw !== 'string' || !isAddress(ownerRaw)) {
      return NextResponse.json<ResponsePayload>(
        { ok: false, step, error: 'Missing or invalid "owner" address.' },
        { status: 400 },
      );
    }
    const owner = ownerRaw as `0x${string}`;

    const fileEntries = form.getAll('files').filter((f): f is File => f instanceof File);
    if (fileEntries.length === 0) {
      return NextResponse.json<ResponsePayload>(
        { ok: false, step, error: 'No files uploaded.' },
        { status: 400 },
      );
    }

    const TOTAL_LIMIT = 25 * 1024 * 1024;
    let totalBytes = 0;
    const inputFiles = [];
    for (const file of fileEntries) {
      totalBytes += file.size;
      if (totalBytes > TOTAL_LIMIT) {
        return NextResponse.json<ResponsePayload>(
          { ok: false, step, error: `Total upload exceeds ${TOTAL_LIMIT} bytes.` },
          { status: 413 },
        );
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      inputFiles.push({
        path: file.name,
        bytes: buf,
        mimeType: file.type || undefined,
      });
    }

    let compiler = deterministicCompiler;
    if (compileMode === 'tee' || compileMode === 'compute' || compileMode === '0g') {
      try {
        compiler = createComputeCompiler();
      } catch (err) {
        return NextResponse.json<ResponsePayload>(
          {
            ok: false,
            step,
            error: `TEE compile backend unavailable: ${err instanceof Error ? err.message : String(err)}`,
          },
          { status: 500 },
        );
      }
    }

    const compiled = await compileKnowledge(inputFiles, { compiler });
    if (compiled.articles.length === 0) {
      return NextResponse.json<ResponsePayload>(
        {
          ok: false,
          step,
          error:
            'No articles were produced. Upload markdown, plain text, PDF, or DOCX files with some real content.',
          unsupported: compiled.unsupported,
          failed: compiled.failed,
        },
        { status: 422 },
      );
    }

    const articleSummary = compiled.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      linkCount: a.links.length,
      bodyChars: a.body.length,
      sources: a.sources,
    }));

    // === Preview phase: return article preview without uploading ===
    if (step === 'preview') {
      return NextResponse.json<ResponsePayload>({
        ok: true,
        step: 'preview',
        articleCount: compiled.articles.length,
        articles: articleSummary,
        formatBreakdown: compiled.formatBreakdown,
        unsupported: compiled.unsupported,
        failed: compiled.failed,
      });
    }

    // === Finalize phase: actually upload to 0G Storage ===
    const signerKey = process.env.ZG_WALLET_PRIVATE_KEY;
    if (!signerKey) {
      return NextResponse.json<ResponsePayload>(
        {
          ok: false,
          step,
          error: 'Server is missing ZG_WALLET_PRIVATE_KEY; storage upload disabled.',
        },
        { status: 500 },
      );
    }

    const zgConfig = loadZgConfig();
    const logClient = createBrainLogClient(zgConfig, signerKey);
    const articleRecords = compiled.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      body: a.body,
      links: a.links,
      sources: a.sources,
      updatedAt: a.updatedAt,
    }));
    const snapshot = await logClient.uploadSnapshot(owner, articleRecords, null);

    return NextResponse.json<ResponsePayload>({
      ok: true,
      step: 'finalize',
      rootHash: snapshot.rootHash as `0x${string}`,
      articleCount: compiled.articles.length,
      articles: articleSummary,
      formatBreakdown: compiled.formatBreakdown,
      unsupported: compiled.unsupported,
      failed: compiled.failed,
      storageUploadTx: snapshot.txHash,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/create] error:', err);
    return NextResponse.json<ResponsePayload>(
      { ok: false, step, error: msg },
      { status: 500 },
    );
  }
}
