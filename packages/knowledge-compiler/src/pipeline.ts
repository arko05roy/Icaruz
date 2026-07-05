import { deterministicCompiler } from './compilers/deterministic.js';
import { docxExtractor } from './extractors/docx.js';
import { markdownExtractor } from './extractors/markdown.js';
import { pdfExtractor } from './extractors/pdf.js';
import { textExtractor } from './extractors/text.js';
import { buildGraph } from './graph.js';
import { segmentDocuments } from './segmenter.js';
import type {
  ArticleGraph,
  Compiler,
  CompiledArticle,
  Extractor,
  InputFile,
  RawDocument,
  SupportedFormat,
} from './types.js';

export interface CompileOptions {
  /** Override the default compiler (e.g. swap for a 0G Compute backend). */
  compiler?: Compiler;
  /** Override the default extractor set. */
  extractors?: Extractor[];
}

export interface CompileResult {
  articles: CompiledArticle[];
  graph: ArticleGraph;
  /** Files we skipped because no extractor accepted them. */
  unsupported: Array<{ path: string; reason: string }>;
  /** Files we attempted but that errored during extraction. */
  failed: Array<{ path: string; error: string }>;
  /** Counts by source format. */
  formatBreakdown: Record<SupportedFormat | 'unsupported' | 'failed', number>;
}

export const defaultExtractors: Extractor[] = [
  markdownExtractor,
  textExtractor,
  pdfExtractor,
  docxExtractor,
];

/**
 * Top-level pipeline. Takes a list of input files and returns compiled wiki
 * articles ready for snapshot upload. Always succeeds, even if some files
 * fail — failures are surfaced in the result, not thrown.
 */
export async function compileKnowledge(
  files: InputFile[],
  opts: CompileOptions = {},
): Promise<CompileResult> {
  const extractors = opts.extractors ?? defaultExtractors;
  const compiler = opts.compiler ?? deterministicCompiler;

  const documents: RawDocument[] = [];
  const unsupported: Array<{ path: string; reason: string }> = [];
  const failed: Array<{ path: string; error: string }> = [];
  const formatBreakdown: Record<SupportedFormat | 'unsupported' | 'failed', number> = {
    markdown: 0,
    text: 0,
    pdf: 0,
    docx: 0,
    html: 0,
    unsupported: 0,
    failed: 0,
  };

  for (const file of files) {
    const extractor = extractors.find((e) => e.accepts(file));
    if (!extractor) {
      unsupported.push({ path: file.path, reason: 'no extractor for this format' });
      formatBreakdown.unsupported++;
      continue;
    }
    try {
      const doc = await extractor.extract(file);
      documents.push(doc);
      formatBreakdown[doc.format]++;
    } catch (err) {
      failed.push({
        path: file.path,
        error: err instanceof Error ? err.message : String(err),
      });
      formatBreakdown.failed++;
    }
  }

  const candidates = segmentDocuments(documents);
  const articles = await compiler.compile(candidates);
  const graph = buildGraph(articles);

  return { articles, graph, unsupported, failed, formatBreakdown };
}
