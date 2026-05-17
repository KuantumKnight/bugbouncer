/**
 * BugBouncer AST Module — Public API
 *
 * Barrel export for the AST parsing, structural hashing,
 * and dependency extraction engine.
 */

// Singleton instances (primary API)
export { ast_parser } from "./parser";
export { structural_hasher } from "./hasher";
export { dependency_extractor } from "./extractor";

// Classes (for testing / advanced usage)
export { AstParser } from "./parser";
export { StructuralHasher } from "./hasher";
export { DependencyExtractor } from "./extractor";

// Types
export type {
  ComponentAST,
  ImportInfo,
  ExportInfo,
  HookUsage,
  DirectiveInfo,
  StructuralHash,
  DriftResult,
  DependencyInfo,
} from "./types";
