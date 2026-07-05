import { NextResponse } from 'next/server';
import { isBrainRuntimeConfigured } from '@/lib/brain-runtime';
import { isBtlConfigured } from '@brainpedia/compute-btl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'brainpedia-web',
    btl: isBtlConfigured(),
    brain: isBrainRuntimeConfigured(),
  });
}
