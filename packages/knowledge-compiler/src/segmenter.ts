import type { ArticleCandidate, RawDocument, StructureHint } from './types.js';

const TARGET_MIN_CHARS = 400;
const TARGET_MAX_CHARS = 6000;

/**
 * Split a RawDocument into article candidates. Strategy:
 *   1. If the doc has heading-1/heading-2 hints, split on those.
 *   2. Else if it has page-break hints, split on those.
 *   3. Else fall back to size-based chunking with overlap.
 *
 * Short adjacent sections are merged so we don't produce dozens of tiny
 * articles for a doc with many small headings.
 */
export function segmentDocuments(docs: RawDocument[]): ArticleCandidate[] {
  const out: ArticleCandidate[] = [];
  for (const doc of docs) {
    const slices = sliceOne(doc);
    for (const slice of slices) {
      out.push({
        title: slice.title,
        text: slice.text,
        sources: [{ path: doc.path, format: doc.format }],
      });
    }
  }
  return out;
}

function sliceOne(doc: RawDocument): Array<{ title: string; text: string }> {
  // Prefer heading-based splits if available.
  const headingHints = doc.structureHints.filter(
    (h) => h.kind === 'heading-1' || h.kind === 'heading-2',
  );
  if (headingHints.length >= 2) {
    return splitByOffsets(doc.text, headingHints, doc.title);
  }

  // Fall back to page-breaks.
  const pageHints = doc.structureHints.filter((h) => h.kind === 'page-break');
  if (pageHints.length >= 2) {
    return mergeAndSplit(splitByOffsets(doc.text, pageHints, doc.title));
  }

  // Final fallback: size-based.
  return sizeChunk(doc.text, doc.title);
}

function splitByOffsets(
  text: string,
  hints: StructureHint[],
  fallbackTitle: string,
): Array<{ title: string; text: string }> {
  const sorted = [...hints].sort((a, b) => a.offset - b.offset);
  const slices: Array<{ title: string; text: string }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const here = sorted[i];
    const next = sorted[i + 1];
    if (!here) continue;
    const start = here.offset;
    const end = next ? next.offset : text.length;
    const sliceText = text.slice(start, end).trim();
    if (sliceText.length === 0) continue;
    const title = here.label ?? `${fallbackTitle} - section ${i + 1}`;
    slices.push({ title, text: sliceText });
  }

  // Catch any preamble before the first hint.
  const first = sorted[0];
  if (first && first.offset > 0) {
    const preamble = text.slice(0, first.offset).trim();
    if (preamble.length >= TARGET_MIN_CHARS) {
      slices.unshift({ title: `${fallbackTitle} - intro`, text: preamble });
    }
  }

  return mergeAndSplit(slices);
}

function mergeAndSplit(
  slices: Array<{ title: string; text: string }>,
): Array<{ title: string; text: string }> {
  // Merge consecutive tiny slices, then size-split any oversize slices.
  const merged: Array<{ title: string; text: string }> = [];
  for (const slice of slices) {
    const last = merged[merged.length - 1];
    if (last && last.text.length < TARGET_MIN_CHARS) {
      last.text = `${last.text}\n\n${slice.text}`;
    } else {
      merged.push({ ...slice });
    }
  }

  const out: Array<{ title: string; text: string }> = [];
  for (const slice of merged) {
    if (slice.text.length <= TARGET_MAX_CHARS) {
      out.push(slice);
    } else {
      out.push(...sizeChunk(slice.text, slice.title));
    }
  }
  return out;
}

function sizeChunk(text: string, title: string): Array<{ title: string; text: string }> {
  const out: Array<{ title: string; text: string }> = [];
  let chunkIdx = 1;
  for (let i = 0; i < text.length; i += TARGET_MAX_CHARS) {
    const slice = text.slice(i, i + TARGET_MAX_CHARS).trim();
    if (slice.length === 0) continue;
    out.push({
      title: chunkIdx === 1 && i === 0 ? title : `${title} - part ${chunkIdx}`,
      text: slice,
    });
    chunkIdx++;
  }
  return out;
}
