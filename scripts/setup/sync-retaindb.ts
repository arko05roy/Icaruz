/**
 * Backfill local brain snapshots + catalog into RetainDB.
 * Run with RetainDB local up: `bun run retaindb:local` then `bun scripts/setup/sync-retaindb.ts`
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRetainDbReachable,
  storeBrainArticles,
  storeBrainCatalogRecord,
} from '@brainpedia/storage-retaindb';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = process.env.BRAINS_DATA_DIR?.trim() || join(repoRoot, 'apps/web/data');

async function main() {
  if (!(await isRetainDbReachable())) {
    console.error('RetainDB not reachable — check RETAINDB_BASE_URL and RETAINDB_API_KEY in .env');
    process.exit(1);
  }

  const raw = await readFile(join(dataDir, 'brains.json'), 'utf8');
  const brains = JSON.parse(raw) as Array<{ id: string }>;
  let articleCount = 0;

  for (const brain of brains) {
    await storeBrainCatalogRecord(brain as Record<string, unknown>);
    try {
      const snapRaw = await readFile(join(dataDir, 'snapshots', `${brain.id}.json`), 'utf8');
      const snap = JSON.parse(snapRaw) as { payload: Parameters<typeof storeBrainArticles>[1] };
      if (snap.payload?.length) {
        await storeBrainArticles(brain.id, snap.payload);
        articleCount += snap.payload.length;
      }
    } catch {
      /* no snapshot for this brain */
    }
    console.log('synced', brain.id);
  }

  console.log(`done — ${brains.length} brains, ${articleCount} articles`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
