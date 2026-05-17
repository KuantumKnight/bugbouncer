/**
 * BugBouncer AST Module Types
 *
 * MANDATORY CONVENTION: All keys MUST be in snake_case.
 * These types define the contracts for AST parsing, structural hashing,
 * dependency extraction, and schema drift detection.
 */

import type * as ts from "typescript";

// ──────────────────────────────────────────────
// Import / Export Metadata
// ──────────────────────────────────────────────

export interface ImportInfo {
  /** The module specifier, e.g. "react", "next/navigation", "./utils" */
  source: string;
  /** Named imports, e.g. ["useState", "useEffect"] */
  named_bindings: string[];
  /** Default import name, e.g. "React" */
  default_binding?: string;
  /** Namespace import name, e.g. "ts" for `import * as ts from ...` */
  namespace_binding?: string;
  /** Whether this is a type-only import (`import type { ... }`) */
  is_type_only: boolean;
}

export interface ExportInfo {
  /** The exported name */
  name: string;
  /** Whether this is a default export */
  is_default: boolean;
  /** The kind of export: function, class, variable, type, interface, re-export */
  kind: "function" | "class" | "variable" | "type" | "interface" | "re_export" | "unknown";
  /** Whether this is a type-only export */
  is_type_only: boolean;
}

// ──────────────────────────────────────────────
// Hook & State Metadata
// ──────────────────────────────────────────────

export interface HookUsage {
  /** The hook name, e.g. "useState", "useRouter", "useCustomHook" */
  hook_name: string;
  /** Whether it is a built-in React hook */
  is_builtin: boolean;
  /** The import source of the hook, e.g. "react", "next/navigation" */
  source?: string;
  /** Number of times the hook is called in the component */
  call_count: number;
}

export interface DirectiveInfo {
  /** The directive string, e.g. "use client", "use server" */
  value: string;
  /** Whether this is a file-level directive (first statement) */
  is_file_level: boolean;
}

// ──────────────────────────────────────────────
// Component AST Representation
// ──────────────────────────────────────────────

export interface ComponentAST {
  /** The file path this AST was parsed from */
  file_path: string;
  /** All import declarations found in the file */
  imports: ImportInfo[];
  /** All export declarations found in the file */
  exports: ExportInfo[];
  /** All React hook usages found in the file */
  hooks: HookUsage[];
  /** File-level directives ('use client', 'use server') */
  directives: DirectiveInfo[];
  /** The raw TypeScript SourceFile node (not serializable — for in-memory use) */
  source_file: ts.SourceFile;
  /** Number of top-level statements (structural density metric) */
  statement_count: number;
}

// ──────────────────────────────────────────────
// Structural Hashing
// ──────────────────────────────────────────────

export interface StructuralHash {
  /** The SHA-256 hex digest representing the component's structural fingerprint */
  hash: string;
  /** The file path this hash was computed from */
  file_path: string;
  /** ISO timestamp of when the hash was computed */
  computed_at: string;
  /** Number of AST nodes traversed during hash computation */
  node_count: number;
}

// ──────────────────────────────────────────────
// Drift Detection
// ──────────────────────────────────────────────

export interface DriftResult {
  /** Whether the component has drifted from its previous hash */
  has_drifted: boolean;
  /** The current structural hash */
  current_hash: string;
  /** The previous structural hash being compared against */
  previous_hash: string;
  /** The file path of the component */
  file_path: string;
  /** ISO timestamp of when drift was detected */
  detected_at: string;
}

// ──────────────────────────────────────────────
// Dependency Graph (feeds into DAG Mapper)
// ──────────────────────────────────────────────

export interface DependencyInfo {
  /** The file path of the source component */
  source_file: string;
  /** Import dependencies extracted from the component */
  imports: ImportInfo[];
  /** Hook dependencies extracted from the component */
  hooks: HookUsage[];
  /** Export surface of the component */
  exports: ExportInfo[];
}
