import type { Extractor, InputFile, RawDocument } from '../types.js';

const TXT_EXTENSIONS = new Set(['.txt', '.text', '.log']);

export const textExtractor: Extractor = {
  format: 'text',
  accepts(file: InputFile): boolean {
    const ext = extOf(file.path);
    if (TXT_EXTENSIONS.has(ext)) return true;
    return file.mimeType === 'text/plain';
  },
  async extract(file: InputFile): Promise<RawDocument> {
    const text = new TextDecoder('utf-8').decode(file.bytes);
    return {
      path: file.path,
      title: basenameNoExt(file.path),
      text,
      structureHints: [],
      format: 'text',
    };
  },
};

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
