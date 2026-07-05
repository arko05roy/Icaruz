/**
 * @brainpedia/knowledge-compiler
 *
 * A format-agnostic pipeline that turns a folder of mixed knowledge files
 * (markdown, plain text, PDF, DOCX) into a Karpathy-style LLM wiki ready to
 * be snapshotted into 0G Storage and minted as an ERC-7857 Brain iNFT.
 *
 * Pipeline:
 *   File          (any format the registered extractors accept)
 *     ↓ Extractor (one per format, pluggable)
 *   RawDocument   (plain text + structure hints + provenance)
 *     ↓ Segmenter (heading-aware, page-aware, size-bounded)
 *   ArticleCandidate[]
 *     ↓ Compiler  (v1 deterministic; v2 swappable for 0G Compute TEE inference)
 *   CompiledArticle[]
 *     ↓ buildGraph
 *   ArticleGraph  (articles + adjacency + backlinks)
 *
 * The output ArticleGraph is consumed by @brainpedia/storage-0g's
 * createBrainLogClient().uploadSnapshot() which returns a merkle root that
 * gets embedded in the new Brain iNFT via BrainMinter.mintToSender.
 */
export * from './types.js';
export { compileKnowledge, defaultExtractors } from './pipeline.js';
export type { CompileOptions, CompileResult } from './pipeline.js';
export { markdownExtractor } from './extractors/markdown.js';
export { textExtractor } from './extractors/text.js';
export { pdfExtractor } from './extractors/pdf.js';
export { docxExtractor } from './extractors/docx.js';
export { deterministicCompiler } from './compilers/deterministic.js';
export { createComputeCompiler } from './compilers/compute-0g.js';
export type { ComputeCompilerOptions } from './compilers/compute-0g.js';
export { segmentDocuments } from './segmenter.js';
export { buildGraph } from './graph.js';
