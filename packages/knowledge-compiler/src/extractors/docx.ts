import type { Extractor, InputFile, RawDocument, StructureHint } from '../types.js';

const DOCX_EXTENSIONS = new Set(['.docx']);

export const docxExtractor: Extractor = {
  format: 'docx',
  accepts(file: InputFile): boolean {
    const ext = extOf(file.path);
    if (DOCX_EXTENSIONS.has(ext)) return true;
    return (
      file.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  },
  async extract(file: InputFile): Promise<RawDocument> {
    // mammoth → HTML preserves heading tags. We convert to a markdown-ish
    // form so the standard heading regex pipeline picks them up.
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(file.bytes) });
    const md = htmlToPseudoMarkdown(result.value);

    return {
      path: file.path,
      title: firstHeading(md) ?? basenameNoExt(file.path),
      text: md,
      structureHints: parseHints(md),
      format: 'docx',
    };
  },
};

/**
 * Tiny HTML→markdown converter focused on what mammoth emits: headings,
 * paragraphs, lists. Anything else falls through as plain text. We don't
 * pull in a full HTML parser because we only need heading structure
 * preserved.
 */
function htmlToPseudoMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, (_m, t) => `\n\n# ${stripTags(t)}\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, (_m, t) => `\n\n## ${stripTags(t)}\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, (_m, t) => `\n\n### ${stripTags(t)}\n`)
    .replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gis, (_m, t) => `\n\n#### ${stripTags(t)}\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_m, t) => `\n${stripTags(t)}\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_m, t) => `- ${stripTags(t)}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

function parseHints(md: string): StructureHint[] {
  const hints: StructureHint[] = [];
  const lines = md.split('\n');
  let offset = 0;
  for (const line of lines) {
    const h1 = /^# (.+)$/.exec(line);
    const h2 = /^## (.+)$/.exec(line);
    const h3 = /^### (.+)$/.exec(line);
    if (h1?.[1]) hints.push({ offset, kind: 'heading-1', label: h1[1].trim() });
    else if (h2?.[1]) hints.push({ offset, kind: 'heading-2', label: h2[1].trim() });
    else if (h3?.[1]) hints.push({ offset, kind: 'heading-3', label: h3[1].trim() });
    offset += line.length + 1;
  }
  return hints;
}

function firstHeading(md: string): string | null {
  const m = /^#{1,3} (.+)$/m.exec(md);
  return m?.[1] ? m[1].trim() : null;
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
