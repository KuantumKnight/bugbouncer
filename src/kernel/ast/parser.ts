/**
 * BugBouncer AST Parser
 *
 * Parses TypeScript/JSX component source code into a structured
 * ComponentAST representation using the TypeScript Compiler API.
 *
 * MANDATORY CONVENTION: All function names and keys in snake_case.
 * ISOLATION: Operates on file content strings only — never imports target code.
 * ERROR HANDLING: Kernel Panic pattern — catch and return safe fallback.
 */

import * as ts from "typescript";
import type {
  ComponentAST,
  ImportInfo,
  ExportInfo,
  HookUsage,
  DirectiveInfo,
} from "./types";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const REACT_BUILTIN_HOOKS = new Set([
  "useState",
  "useEffect",
  "useContext",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useImperativeHandle",
  "useLayoutEffect",
  "useInsertionEffect",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useActionState",
  "useFormStatus",
  "useOptimistic",
  "use",
]);

// ──────────────────────────────────────────────
// AST Parser
// ──────────────────────────────────────────────

export class AstParser {
  /**
   * Parses a component's source code into a structured ComponentAST.
   *
   * @param file_content  Raw source code string
   * @param file_path     The file path (used for SourceFile naming)
   * @returns             A ComponentAST representation
   */
  public parse_component(file_content: string, file_path: string): ComponentAST {
    try {
      const source_file = ts.createSourceFile(
        file_path,
        file_content,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        this.infer_script_kind(file_path)
      );

      const imports = this.extract_imports(source_file);
      const exports = this.extract_exports(source_file);
      const hooks = this.extract_hooks(source_file, imports);
      const directives = this.extract_directives(source_file);

      return {
        file_path,
        imports,
        exports,
        hooks,
        directives,
        source_file,
        statement_count: source_file.statements.length,
      };
    } catch (e) {
      // Kernel Panic: return a safe empty AST
      console.error("[ast-parser] kernel.panic:", e);
      const empty_source = ts.createSourceFile(
        file_path,
        "",
        ts.ScriptTarget.Latest,
        true
      );
      return {
        file_path,
        imports: [],
        exports: [],
        hooks: [],
        directives: [],
        source_file: empty_source,
        statement_count: 0,
      };
    }
  }

  // ──────────────────────────────────────────────
  // Import Extraction
  // ──────────────────────────────────────────────

  private extract_imports(source_file: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    for (const stmt of source_file.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;

      const module_specifier = stmt.moduleSpecifier;
      if (!ts.isStringLiteral(module_specifier)) continue;

      const source = module_specifier.text;
      const is_type_only = stmt.importClause?.isTypeOnly ?? false;

      const info: ImportInfo = {
        source,
        named_bindings: [],
        is_type_only,
      };

      const clause = stmt.importClause;
      if (clause) {
        // Default import: `import React from "react"`
        if (clause.name) {
          info.default_binding = clause.name.text;
        }

        const bindings = clause.namedBindings;
        if (bindings) {
          if (ts.isNamedImports(bindings)) {
            // Named imports: `import { useState, useEffect } from "react"`
            info.named_bindings = bindings.elements.map((el) => el.name.text);
          } else if (ts.isNamespaceImport(bindings)) {
            // Namespace import: `import * as ts from "typescript"`
            info.namespace_binding = bindings.name.text;
          }
        }
      }

      imports.push(info);
    }

    return imports;
  }

  // ──────────────────────────────────────────────
  // Export Extraction
  // ──────────────────────────────────────────────

  private extract_exports(source_file: ts.SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const stmt of source_file.statements) {
      // Named export declarations: `export function foo()`, `export class Bar`
      if (this.has_export_modifier(stmt)) {
        if (ts.isFunctionDeclaration(stmt)) {
          exports.push({
            name: stmt.name?.text ?? "anonymous",
            is_default: this.has_default_modifier(stmt),
            kind: "function",
            is_type_only: false,
          });
        } else if (ts.isClassDeclaration(stmt)) {
          exports.push({
            name: stmt.name?.text ?? "anonymous",
            is_default: this.has_default_modifier(stmt),
            kind: "class",
            is_type_only: false,
          });
        } else if (ts.isVariableStatement(stmt)) {
          for (const decl of stmt.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              exports.push({
                name: decl.name.text,
                is_default: false,
                kind: "variable",
                is_type_only: false,
              });
            }
          }
        } else if (ts.isTypeAliasDeclaration(stmt)) {
          exports.push({
            name: stmt.name.text,
            is_default: false,
            kind: "type",
            is_type_only: true,
          });
        } else if (ts.isInterfaceDeclaration(stmt)) {
          exports.push({
            name: stmt.name.text,
            is_default: false,
            kind: "interface",
            is_type_only: true,
          });
        }
      }

      // Export default expression: `export default function MyComponent()`
      if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
        const expr = stmt.expression;
        let name = "default";
        if (ts.isIdentifier(expr)) {
          name = expr.text;
        }
        exports.push({
          name,
          is_default: true,
          kind: "unknown",
          is_type_only: false,
        });
      }

      // Re-exports: `export { foo } from "./bar"`
      if (ts.isExportDeclaration(stmt)) {
        const is_type_only = stmt.isTypeOnly;
        if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
          for (const el of stmt.exportClause.elements) {
            exports.push({
              name: el.name.text,
              is_default: false,
              kind: "re_export",
              is_type_only,
            });
          }
        }
      }
    }

    return exports;
  }

  // ──────────────────────────────────────────────
  // Hook Extraction
  // ──────────────────────────────────────────────

  private extract_hooks(source_file: ts.SourceFile, imports: ImportInfo[]): HookUsage[] {
    const hook_map = new Map<string, HookUsage>();

    // Build a lookup: hook_name → import source
    const hook_source_map = new Map<string, string>();
    for (const imp of imports) {
      for (const binding of imp.named_bindings) {
        if (this.is_hook_name(binding)) {
          hook_source_map.set(binding, imp.source);
        }
      }
      if (imp.default_binding && this.is_hook_name(imp.default_binding)) {
        hook_source_map.set(imp.default_binding, imp.source);
      }
    }

    // Walk the AST to find all call expressions matching hook patterns
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let hook_name: string | null = null;

        if (ts.isIdentifier(callee) && this.is_hook_name(callee.text)) {
          hook_name = callee.text;
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.name) &&
          this.is_hook_name(callee.name.text)
        ) {
          // e.g. React.useState()
          hook_name = callee.name.text;
        }

        if (hook_name) {
          const existing = hook_map.get(hook_name);
          if (existing) {
            existing.call_count++;
          } else {
            hook_map.set(hook_name, {
              hook_name,
              is_builtin: REACT_BUILTIN_HOOKS.has(hook_name),
              source: hook_source_map.get(hook_name),
              call_count: 1,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(source_file, visit);
    return Array.from(hook_map.values());
  }

  // ──────────────────────────────────────────────
  // Directive Extraction
  // ──────────────────────────────────────────────

  private extract_directives(source_file: ts.SourceFile): DirectiveInfo[] {
    const directives: DirectiveInfo[] = [];

    for (let i = 0; i < source_file.statements.length; i++) {
      const stmt = source_file.statements[i];
      if (
        ts.isExpressionStatement(stmt) &&
        ts.isStringLiteral(stmt.expression)
      ) {
        const value = stmt.expression.text;
        if (value === "use client" || value === "use server") {
          directives.push({
            value,
            is_file_level: i === 0,
          });
        }
      } else {
        // Directives must be leading; stop scanning once a non-directive is found
        break;
      }
    }

    return directives;
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private is_hook_name(name: string): boolean {
    return /^use[A-Z]/.test(name) || name === "use";
  }

  private has_export_modifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  private has_default_modifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
  }

  private infer_script_kind(file_path: string): ts.ScriptKind {
    if (file_path.endsWith(".tsx")) return ts.ScriptKind.TSX;
    if (file_path.endsWith(".jsx")) return ts.ScriptKind.JSX;
    if (file_path.endsWith(".ts")) return ts.ScriptKind.TS;
    return ts.ScriptKind.JS;
  }
}

export const ast_parser = new AstParser();
