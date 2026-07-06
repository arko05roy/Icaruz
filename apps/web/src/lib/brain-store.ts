import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isAddress, type Address } from 'viem';
import {
  storeBrainArticles,
  storeBrainCatalogRecord,
} from '@brainpedia/storage-retaindb';

export interface CreatorBrainRecord {
  id: string;
  name: string;
  specialty: string;
  topics: string[];
  /** 0x merkle root from 0G upload, or `local:{id}` for file-backed snapshots. */
  storageRoot: string;
  payoutWallet: Address;
  priceUsd: number;
  ownerWallet: Address;
  createdAt: string;
}

export interface SnapshotManifestLocal {
  brainOwner: string;
  createdAt: string;
  articleCount: number;
  payload: Array<{
    slug: string;
    title: string;
    body: string;
    links: string[];
    sources: string[];
    updatedAt: string;
  }>;
}

function dataDir(): string {
  return process.env.BRAINS_DATA_DIR?.trim() || join(process.cwd(), 'data');
}

function brainsPath(): string {
  return join(dataDir(), 'brains.json');
}

function snapshotPath(brainId: string): string {
  return join(dataDir(), 'snapshots', `${brainId}.json`);
}

export function localStorageRoot(brainId: string): string {
  return `local:${brainId}`;
}

async function ensureDataDir(): Promise<void> {
  await mkdir(join(dataDir(), 'snapshots'), { recursive: true });
}

export async function listCreatorBrains(): Promise<CreatorBrainRecord[]> {
  try {
    const raw = await readFile(brainsPath(), 'utf8');
    const parsed = JSON.parse(raw) as CreatorBrainRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getCreatorBrain(id: string): Promise<CreatorBrainRecord | null> {
  const key = id.toLowerCase();
  const brains = await listCreatorBrains();
  return brains.find((b) => b.id === key || b.name.toLowerCase() === key) ?? null;
}

export async function saveLocalSnapshot(
  brainId: string,
  manifest: SnapshotManifestLocal,
): Promise<void> {
  await ensureDataDir();
  await writeFile(snapshotPath(brainId), JSON.stringify(manifest, null, 2), 'utf8');
  void storeBrainArticles(brainId, manifest.payload).catch((err) => {
    console.warn('[brain-store] RetainDB article sync failed:', err);
  });
}

export async function loadLocalSnapshot(brainId: string): Promise<SnapshotManifestLocal | null> {
  try {
    const raw = await readFile(snapshotPath(brainId), 'utf8');
    return JSON.parse(raw) as SnapshotManifestLocal;
  } catch {
    return null;
  }
}

export interface RegisterBrainInput {
  name: string;
  specialty: string;
  topics: string[];
  storageRoot: string;
  payoutWallet: string;
  priceUsd: number;
  ownerWallet: string;
  articles?: SnapshotManifestLocal['payload'];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function registerCreatorBrain(input: RegisterBrainInput): Promise<CreatorBrainRecord> {
  if (!isAddress(input.payoutWallet)) {
    throw new Error('invalid payoutWallet');
  }
  if (!isAddress(input.ownerWallet)) {
    throw new Error('invalid ownerWallet');
  }
  if (!input.specialty.trim()) {
    throw new Error('specialty is required');
  }
  if (!input.storageRoot.trim()) {
    throw new Error('storageRoot is required');
  }

  const priceUsd = Number(input.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    throw new Error('priceUsd must be a non-negative number');
  }

  const topics =
    input.topics.length > 0
      ? input.topics.map((t) => t.toLowerCase())
      : ['all'];

  await ensureDataDir();
  const brains = await listCreatorBrains();
  const baseId = slugify(input.name.trim()) || `brain-${Date.now()}`;
  let id = baseId;
  let n = 2;
  while (brains.some((b) => b.id === id)) {
    id = `${baseId}-${n}`;
    n++;
  }

  if (input.articles?.length) {
    await saveLocalSnapshot(id, {
      brainOwner: input.ownerWallet,
      createdAt: new Date().toISOString(),
      articleCount: input.articles.length,
      payload: input.articles,
    });
  }

  const record: CreatorBrainRecord = {
    id,
    name: input.name.trim() || id,
    specialty: input.specialty.trim(),
    topics,
    storageRoot:
      input.storageRoot && !input.storageRoot.startsWith('local:pending')
        ? input.storageRoot
        : localStorageRoot(id),
    payoutWallet: input.payoutWallet as Address,
    priceUsd,
    ownerWallet: input.ownerWallet as Address,
    createdAt: new Date().toISOString(),
  };

  brains.push(record);
  await writeFile(brainsPath(), JSON.stringify(brains, null, 2), 'utf8');
  void storeBrainCatalogRecord(record as unknown as Record<string, unknown>).catch((err) => {
    console.warn('[brain-store] RetainDB catalog sync failed:', err);
  });
  return record;
}
