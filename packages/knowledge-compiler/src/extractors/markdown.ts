import type { Extractor, InputFile, RawDocument, StructureHint } from '../types.js';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown']);

export const markdownExtractor: Extractor = {
  format: 'markdown',
  accepts(file: InputFile): boolean {
    const ext = extOf(file.path);
    if (MD_EXTENSIONS.has(ext)) return true;
    return file.mimeType === 'text/markdown';
  },
  async extract(file: InputFile): Promise<RawDocument> {
    const text = new TextDecoder('utf-8').decode(file.bytes);
    return {
      path: file.path,
      title: firstHeading(text) ?? basenameNoExt(file.path),
      text,
      structureHints: parseHints(text),
      format: 'markdown',
    };
  },
};

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
