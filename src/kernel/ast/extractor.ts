/**
 * BugBouncer Dependency Extractor
 *
 * Extracts dependency relationships from a ComponentAST:
 * imports, hooks, exports, and shared state providers.
 * Output feeds directly into the DAG Mapper for authority resolution.
 *
 * MANDATORY CONVENTION: All function names and keys in snake_case.
 * ERROR HANDLING: Kernel Panic pattern on all public methods.
 */

import type {
  ComponentAST,
  ImportInfo,
  ExportInfo,
  HookUsage,
  DependencyInfo,
} from "./types";

// ──────────────────────────────────────────────
// State Provider Detection Patterns
// ──────────────────────────────────────────────

/** Import sources that indicate shared state provider usage */
const STATE_PROVIDER_SOURCES = new Set([
  "zustand",
  "zustand/middleware",
  "jotai",
  "jotai/utils",
  "recoil",
  "valtio",
  "@reduxjs/toolkit",
  "react-redux",
]);

/** Hook names that indicate context/provider consumption */
const CONTEXT_HOOKS = new Set([
  "useContext",
  "useStore",
  "useSelector",
  "useDispatch",
  "useAtom",
  "useAtomValue",
  "useSetAtom",
  "useRecoilState",
  "useRecoilValue",
  "useSnapshot",
]);

// ──────────────────────────────────────────────
// Dependency Extractor
// ──────────────────────────────────────────────

export class DependencyExtractor {
  /**
   * Extracts all imports from the ComponentAST.
   * Filters out type-only imports since they don't create runtime dependencies.
   */
  public extract_imports(ast: ComponentAST): ImportInfo[] {
    try {
      return ast.imports.filter((imp) => !imp.is_type_only);
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Extracts all type-only imports from the ComponentAST.
   */
  public extract_type_imports(ast: ComponentAST): ImportInfo[] {
    try {
      return ast.imports.filter((imp) => imp.is_type_only);
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Extracts all hook usages from the ComponentAST.
   */
  public extract_hooks(ast: ComponentAST): HookUsage[] {
    try {
      return ast.hooks;
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Extracts all exports from the ComponentAST.
   */
  public extract_exports(ast: ComponentAST): ExportInfo[] {
    try {
      return ast.exports;
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Identifies imports from known shared state provider libraries.
   */
  public extract_state_providers(ast: ComponentAST): ImportInfo[] {
    try {
      return ast.imports.filter((imp) => STATE_PROVIDER_SOURCES.has(imp.source));
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Identifies hooks that consume shared state (Context, Redux, Zustand, etc.).
   */
  public extract_context_hooks(ast: ComponentAST): HookUsage[] {
    try {
      return ast.hooks.filter((hook) => CONTEXT_HOOKS.has(hook.hook_name));
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Builds a complete DependencyInfo object for the component.
   * This is the primary output consumed by the DAG Mapper.
   */
  public extract_all(ast: ComponentAST): DependencyInfo {
    try {
      return {
        source_file: ast.file_path,
        imports: this.extract_imports(ast),
        hooks: this.extract_hooks(ast),
        exports: this.extract_exports(ast),
      };
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return {
        source_file: ast.file_path,
        imports: [],
        hooks: [],
        exports: [],
      };
    }
  }

  /**
   * Extracts local (relative path) dependencies — components within the same project.
   */
  public extract_local_dependencies(ast: ComponentAST): ImportInfo[] {
    try {
      return ast.imports.filter(
        (imp) =>
          !imp.is_type_only &&
          (imp.source.startsWith("./") ||
            imp.source.startsWith("../") ||
            imp.source.startsWith("@/"))
      );
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }

  /**
   * Extracts external (package) dependencies — third-party libraries.
   */
  public extract_external_dependencies(ast: ComponentAST): ImportInfo[] {
    try {
      return ast.imports.filter(
        (imp) =>
          !imp.is_type_only &&
          !imp.source.startsWith("./") &&
          !imp.source.startsWith("../") &&
          !imp.source.startsWith("@/")
      );
    } catch (e) {
      console.error("[dependency-extractor] kernel.panic:", e);
      return [];
    }
  }
}

export const dependency_extractor = new DependencyExtractor();
