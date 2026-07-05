/**
 * Brainpedia knowledge framework — core types.
 *
 * The pipeline is: File → RawDocument → ArticleCandidate[] → ArticleRecord[].
 * Each stage has a stable shape so format extractors and compile backends are
 * pluggable. The downstream snapshot/upload/mint stages consume ArticleRecord
 * and never know which format the knowledge came from.
 */

/** A file as seen at the top of the pipeline. Buffer + name + mimetype. */
export interface InputFile {
  /** Relative path inside the user-supplied folder. Used to derive slugs. */
  path: string;
  /** Raw bytes of the file. */
  bytes: Uint8Array;
  /** MIME type if known (else inferred from path extension). */
  mimeType?: string;
}

/** What every Extractor returns. Plain text, no compilation logic yet. */
export interface RawDocument {
  /** Source path (for traceability). */
  path: string;
  /** Best-guess title — the first heading if found, else the basename. */
  title: string;
  /** Plain UTF-8 text of the document. Markdown still markdown; PDFs flattened. */
  text: string;
  /** Detected structural hints (heading offsets, page breaks) for the Segmenter. */
  structureHints: StructureHint[];
  /** Original format. */
  format: SupportedFormat;
}

export type SupportedFormat = 'markdown' | 'text' | 'pdf' | 'docx' | 'html';

export interface StructureHint {
  /** Byte offset into RawDocument.text. */
  offset: number;
  /** Hint kind. */
  kind: 'heading-1' | 'heading-2' | 'heading-3' | 'page-break' | 'section-break';
  /** Optional label (heading text for headings). */
  label?: string;
}

/**
 * A pre-compiled article slice. Output of the Segmenter, input to the Compiler.
 * Contains raw text with provenance — no slug or wiki structure yet.
 */
export interface ArticleCandidate {
  /** Best-guess title (first heading or generated). */
  title: string;
  /** Raw text content of this slice. */
  text: string;
  /** Source provenance: which RawDocument(s) this came from. */
  sources: Array<{ path: string; format: SupportedFormat }>;
}

/** Final wiki article. Matches storage-0g's ArticleRecord on the wire. */
export interface CompiledArticle {
  slug: string;
  title: string;
  body: string;
  /** Slugs of articles this one wikilinks to. */
  links: string[];
  /** Source file paths that fed this article. */
  sources: string[];
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/** The full compiled knowledge graph. */
export interface ArticleGraph {
  articles: CompiledArticle[];
  /** slug → linked slugs */
  adjacency: Record<string, string[]>;
  /** slug → slugs that link in */
  backlinks: Record<string, string[]>;
}

/** Pluggable extractor interface. One implementation per format. */
export interface Extractor {
  readonly format: SupportedFormat;
  /** Does this extractor handle the given file? */
  accepts(file: InputFile): boolean;
  extract(file: InputFile): Promise<RawDocument>;
}

/** Pluggable compiler interface. v1 deterministic; v2 swappable for 0G Compute. */
export interface Compiler {
  readonly name: string;
  compile(candidates: ArticleCandidate[]): Promise<CompiledArticle[]>;
}
