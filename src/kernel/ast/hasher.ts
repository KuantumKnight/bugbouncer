/**
 * BugBouncer Structural Hasher
 *
 * Generates deterministic SHA-256 hashes from ComponentAST representations
 * using a Merkle-style recursive traversal. The hash captures structural
 * shape (SyntaxKind, identifiers, imports) while ignoring noise
 * (whitespace, comments, string/numeric literal values).
 *
 * MANDATORY CONVENTION: All function names and keys in snake_case.
 * ERROR HANDLING: Kernel Panic pattern on all public methods.
 */

import { createHash } from "crypto";
import * as ts from "typescript";
import type { ComponentAST, StructuralHash, DriftResult } from "./types";

// ──────────────────────────────────────────────
// Structural Hasher
// ──────────────────────────────────────────────

export class StructuralHasher {
  /**
   * Computes a deterministic structural hash for a ComponentAST.
   *
   * The hash is computed by recursively traversing the SourceFile AST
   * and hashing each node's SyntaxKind + semantically relevant content.
   *
   * @param ast  The parsed ComponentAST
   * @returns    A StructuralHash with the SHA-256 digest
   */
  public compute_hash(ast: ComponentAST): StructuralHash {
    try {
      let node_count = 0;
      const hash = createHash("sha256");

      const visit = (node: ts.Node): void => {
        // Skip comment-related trivia — the AST itself doesn't
        // include comments as nodes, but skip JSDoc containers.
        if (node.kind === ts.SyntaxKind.JSDoc) return;

        // Skip whitespace-only JSX text (formatting noise)
        if (ts.isJsxText(node) && node.text.trim() === "") return;

        node_count++;

        // 1. Hash the node's structural type (SyntaxKind)
        hash.update(ts.SyntaxKind[node.kind]);

        // 2. Hash semantically relevant content per node type
        if (ts.isIdentifier(node)) {
          hash.update(node.text);
        } else if (ts.isStringLiteral(node) && this.is_import_path(node)) {
          // Only hash string literals that are import paths
          hash.update(node.text);
        } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
          hash.update(node.name.text);
        }

        // 3. Recursively hash children (Merkle-style)
        ts.forEachChild(node, visit);
      };

      // Traverse all top-level statements
      ts.forEachChild(ast.source_file, visit);

      return {
        hash: hash.digest("hex"),
        file_path: ast.file_path,
        computed_at: new Date().toISOString(),
        node_count,
      };
    } catch (e) {
      // Kernel Panic: return a zero-hash
      console.error("[structural-hasher] kernel.panic:", e);
      return {
        hash: "0".repeat(64),
        file_path: ast.file_path,
        computed_at: new Date().toISOString(),
        node_count: 0,
      };
    }
  }

  /**
   * Detects structural drift by comparing two StructuralHash values.
   *
   * @param current   The current structural hash
   * @param previous  The previously stored structural hash
   * @returns         A DriftResult indicating whether drift occurred
   */
  public detect_drift(current: StructuralHash, previous: StructuralHash): DriftResult {
    try {
      return {
        has_drifted: current.hash !== previous.hash,
        current_hash: current.hash,
        previous_hash: previous.hash,
        file_path: current.file_path,
        detected_at: new Date().toISOString(),
      };
    } catch (e) {
      console.error("[structural-hasher] kernel.panic:", e);
      return {
        has_drifted: true, // Fail-safe: assume drift on error
        current_hash: current?.hash ?? "",
        previous_hash: previous?.hash ?? "",
        file_path: current?.file_path ?? "",
        detected_at: new Date().toISOString(),
      };
    }
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /**
   * Determines if a StringLiteral is an import path.
   * Import paths appear as the module specifier in ImportDeclaration nodes.
   */
  private is_import_path(node: ts.StringLiteral): boolean {
    const parent = node.parent;
    if (!parent) return false;

    // Direct import: `import { x } from "module"`
    if (ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) {
      return true;
    }

    // Dynamic import: `import("module")`
    if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return true;
    }

    // Re-export: `export { x } from "module"`
    if (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) {
      return true;
    }

    // require(): `require("module")`
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === "require"
    ) {
      return true;
    }

    return false;
  }
}

export const structural_hasher = new StructuralHasher();
