import type { Extractor, InputFile, RawDocument, StructureHint } from '../types.js';

const PDF_EXTENSIONS = new Set(['.pdf']);

export const pdfExtractor: Extractor = {
  format: 'pdf',
  accepts(file: InputFile): boolean {
    const ext = extOf(file.path);
    if (PDF_EXTENSIONS.has(ext)) return true;
    return file.mimeType === 'application/pdf';
  },
  async extract(file: InputFile): Promise<RawDocument> {
    // pdf-parse is CJS-only and reads from Buffer. Loaded dynamically so the
    // package can be used in environments without it (e.g. when callers only
    // need md/txt extraction).
    const mod = await import('pdf-parse');
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string; numpages: number }>;
    const result = await pdfParse(Buffer.from(file.bytes));
    const text = result.text.trim();

    return {
      path: file.path,
      title: firstHeadingLike(text) ?? basenameNoExt(file.path),
      text,
      // PDFs lose explicit heading structure during extraction. We mark page
      // breaks as section-breaks so the Segmenter has SOMETHING to split on.
      structureHints: pageBreakHints(text),
      format: 'pdf',
    };
  },
};

function pageBreakHints(text: string): StructureHint[] {
  // pdf-parse separates pages with form feed (\f). Convert those into hints.
  const hints: StructureHint[] = [];
  let i = -1;
  while ((i = text.indexOf('\f', i + 1)) !== -1) {
    hints.push({ offset: i, kind: 'page-break' });
  }
  return hints;
}

function firstHeadingLike(text: string): string | null {
  // Heuristic: the first non-empty line that's <80 chars and not a date/number
  // is a plausible title.
  for (const line of text.split('\n').slice(0, 50)) {
    const t = line.trim();
    if (t.length === 0 || t.length > 80) continue;
    if (/^\d/.test(t) && t.length < 20) continue;
    return t;
  }
  return null;
}

function extOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot).toLowerCase() : '';
}

function basenameNoExt(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(0, dot) : base;
}
