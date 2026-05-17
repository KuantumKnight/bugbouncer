/**
 * BugBouncer Supabase Drift Detector
 *
 * Compares local TypeScript schema definitions (AST) against live Supabase
 * schema introspection to detect structural discrepancies (Schema Drift).
 *
 * MANDATORY CONVENTION: All methods and properties in snake_case.
 * ERROR HANDLING: Kernel Panic pattern — catch exceptions and return safe fallback.
 */

import * as ts from "typescript";
import * as fs from "fs";
import { ast_parser } from "../ast/parser";
import type {
  SupabaseSchemaInfo,
  TableDefinition,
  ColumnDefinition,
  SupabaseDriftResult,
  DriftMismatch,
} from "./types";

export class SupabaseDriftDetector {
  private schema_cache = new Map<string, { content: string; parsed: SupabaseSchemaInfo }>();

  /**
   * Parses a local TypeScript schema file (e.g., types/supabase.ts) to extract
   * table and column definitions using the TypeScript AST parser.
   *
   * Enforces the Kernel Panic error handling pattern.
   *
   * @param file_path The path to the local TypeScript definition file
   * @param optional_file_content Optional raw file content string (for browser/worker or mock environments)
   * @returns A SupabaseSchemaInfo object representing local type definitions
   */
  public parse_local_schema(
    file_path: string,
    optional_file_content?: string
  ): SupabaseSchemaInfo {
    try {
      let file_content = typeof optional_file_content === "string" ? optional_file_content : undefined;
      if (file_content === undefined) {
        if (typeof fs !== "undefined" && typeof fs.readFileSync === "function") {
          file_content = fs.readFileSync(file_path, "utf-8");
        } else {
          throw new Error(`File content required in non-Node environments for: ${file_path}`);
        }
      }

      // Check schema cache for optimization
      const cached = this.schema_cache.get(file_path);
      if (cached && cached.content === file_content) {
        return cached.parsed;
      }

      const ast = ast_parser.parse_component(file_content, file_path);
      const source_file = ast.source_file;
      const tables: Record<string, TableDefinition> = {};

      // Strategy 1: Look for Supabase CLI generated `Database` interface / type alias
      let database_node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null = null;

      for (const stmt of source_file.statements) {
        if (ts.isInterfaceDeclaration(stmt) && stmt.name?.text === "Database") {
          database_node = stmt;
          break;
        }
        if (ts.isTypeAliasDeclaration(stmt) && stmt.name?.text === "Database") {
          database_node = stmt;
          break;
        }
      }

      if (database_node) {
        this.extract_from_database_node(database_node, tables);
      } else {
        // Strategy 2: Fallback to scanning all exported interfaces as table definitions
        this.extract_from_exported_interfaces(source_file, tables);
      }

      const result: SupabaseSchemaInfo = {
        schema_name: "local_ts",
        tables,
        fetched_at_iso: new Date().toISOString(),
      };

      this.schema_cache.set(file_path, { content: file_content, parsed: result });
      return result;
    } catch (e) {
      console.error("[drift-detector] kernel.panic (parse_local_schema):", e);
      return {
        schema_name: "local_ts",
        tables: {},
        fetched_at_iso: new Date().toISOString(),
      };
    }
  }

  /**
   * Performs a deep structural comparison between local TypeScript definitions
   * and live Supabase schema introspection to detect schema drift.
   *
   * Enforces the Kernel Panic error handling pattern.
   *
   * @param local_schema The schema parsed from local TypeScript definitions
   * @param live_schema The schema introspected from the live Supabase instance
   * @returns A SupabaseDriftResult containing detailed mismatch reports
   */
  public detect_supabase_drift(
    local_schema: SupabaseSchemaInfo,
    live_schema: SupabaseSchemaInfo
  ): SupabaseDriftResult {
    try {
      const mismatches: DriftMismatch[] = [];
      const scanned_tables = new Set<string>();

      // 1. Compare Local -> Live (Check for missing live tables/columns, type mismatches)
      for (const [table_name, local_table] of Object.entries(local_schema.tables)) {
        scanned_tables.add(table_name);
        const live_table = live_schema.tables[table_name];

        if (!live_table) {
          mismatches.push({
            mismatch_type: "missing_table",
            table_name,
            description: `Table '${table_name}' is defined locally but missing in live Supabase schema.`,
          });
          continue;
        }

        for (const [col_name, local_col] of Object.entries(local_table.columns)) {
          const live_col = live_table.columns ? live_table.columns[col_name] : undefined;

          if (!live_col) {
            mismatches.push({
              mismatch_type: "missing_column",
              table_name,
              column_name: col_name,
              description: `Column '${col_name}' in table '${table_name}' is defined locally but missing in live Supabase schema.`,
            });
            continue;
          }

          // Compare Data Types
          if (!this.are_types_compatible(local_col.data_type, live_col.data_type)) {
            mismatches.push({
              mismatch_type: "type_mismatch",
              table_name,
              column_name: col_name,
              expected_type: local_col.data_type,
              actual_type: live_col.data_type,
              description: `Type mismatch for '${table_name}.${col_name}'. Local expects '${local_col.data_type}', but live database is '${live_col.data_type}'.`,
            });
          }

          // Compare Nullability
          if (local_col.is_nullable !== live_col.is_nullable) {
            mismatches.push({
              mismatch_type: "nullability_mismatch",
              table_name,
              column_name: col_name,
              expected_nullable: local_col.is_nullable,
              actual_nullable: live_col.is_nullable,
              description: `Nullability mismatch for '${table_name}.${col_name}'. Local nullable is ${local_col.is_nullable}, but live database nullable is ${live_col.is_nullable}.`,
            });
          }
        }
      }

      // 2. Compare Live -> Local (Check for tables/columns in live database missing in local TS)
      for (const [table_name, live_table] of Object.entries(live_schema.tables)) {
        scanned_tables.add(table_name);
        const local_table = local_schema.tables[table_name];

        if (!local_table) {
          mismatches.push({
            mismatch_type: "missing_table",
            table_name,
            description: `Table '${table_name}' exists in live Supabase schema but is missing from local TypeScript definitions.`,
          });
          continue;
        }

        for (const col_name of Object.keys(live_table.columns || {})) {
          if (!local_table.columns || !local_table.columns[col_name]) {
            mismatches.push({
              mismatch_type: "missing_column",
              table_name,
              column_name: col_name,
              description: `Column '${col_name}' in table '${table_name}' exists in live Supabase schema but is missing from local TypeScript definitions.`,
            });
          }
        }
      }

      return {
        scanned_at_iso: new Date().toISOString(),
        has_drift: mismatches.length > 0,
        mismatches,
        scanned_tables_count: scanned_tables.size,
      };
    } catch (e) {
      console.error("[drift-detector] kernel.panic (detect_supabase_drift):", e);
      return {
        scanned_at_iso: new Date().toISOString(),
        has_drift: false,
        mismatches: [],
        scanned_tables_count: 0,
        error_message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ──────────────────────────────────────────────
  // AST Extraction Helpers
  // ──────────────────────────────────────────────

  private extract_from_database_node(
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    tables: Record<string, TableDefinition>
  ): void {
    // Navigate Database -> public -> Tables
    let public_type: ts.TypeLiteralNode | null = null;

    const check_members = (members: ts.NodeArray<ts.TypeElement>) => {
      for (const m of members) {
        if (ts.isPropertySignature(m) && m.name && m.name.getText().replace(/['"]/g, "") === "public" && m.type && ts.isTypeLiteralNode(m.type)) {
          public_type = m.type;
          break;
        }
      }
    };

    if (ts.isInterfaceDeclaration(node)) {
      check_members(node.members);
    } else if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      check_members(node.type.members);
    }

    if (!public_type) return;

    // TypeScript needs a local binding after the guard since `public_type`
    // was assigned inside a closure and tsc narrows it to `never`.
    const public_node: ts.TypeLiteralNode = public_type;

    let tables_type: ts.TypeLiteralNode | null = null;
    for (const m of public_node.members) {
      if (ts.isPropertySignature(m) && m.name && m.name.getText().replace(/['"]/g, "") === "Tables" && m.type && ts.isTypeLiteralNode(m.type)) {
        tables_type = m.type;
        break;
      }
    }

    if (!tables_type) return;

    // Iterate over each table in Tables
    for (const table_member of tables_type.members) {
      if (!ts.isPropertySignature(table_member) || !table_member.name || !table_member.type || !ts.isTypeLiteralNode(table_member.type)) {
        continue;
      }

      const table_name = table_member.name.getText().replace(/['"]/g, "");
      let row_type: ts.TypeLiteralNode | null = null;

      for (const m of table_member.type.members) {
        if (ts.isPropertySignature(m) && m.name && m.name.getText().replace(/['"]/g, "") === "Row" && m.type && ts.isTypeLiteralNode(m.type)) {
          row_type = m.type;
          break;
        }
      }

      if (!row_type) continue;

      const columns: Record<string, ColumnDefinition> = {};
      const primary_keys: string[] = [];

      for (const col_member of row_type.members) {
        if (!ts.isPropertySignature(col_member) || !col_member.name || !col_member.type) continue;

        const col_name = col_member.name.getText().replace(/['"]/g, "");
        const { data_type, is_nullable } = this.infer_sql_type_from_ts_node(col_member.type, !!col_member.questionToken);

        const is_primary_key = col_name === "id"; // Fallback TS PK heuristic
        if (is_primary_key) primary_keys.push(col_name);

        columns[col_name] = {
          column_name: col_name,
          data_type,
          is_nullable,
          default_value: null,
          is_primary_key,
        };
      }

      tables[table_name] = {
        table_name,
        columns,
        primary_keys,
      };
    }
  }

  private extract_from_exported_interfaces(
    source_file: ts.SourceFile,
    tables: Record<string, TableDefinition>
  ): void {
    for (const stmt of source_file.statements) {
      if (!ts.isInterfaceDeclaration(stmt)) continue;

      // Check if exported
      const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const is_exported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

      if (!is_exported) continue;
      if (!stmt.name) continue;

      const table_name = stmt.name.text.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      const columns: Record<string, ColumnDefinition> = {};
      const primary_keys: string[] = [];

      for (const m of stmt.members) {
        if (!ts.isPropertySignature(m) || !m.name || !m.type) continue;

        const col_name = m.name.getText().replace(/['"]/g, "");
        const { data_type, is_nullable } = this.infer_sql_type_from_ts_node(m.type, !!m.questionToken);

        const is_primary_key = col_name === "id";
        if (is_primary_key) primary_keys.push(col_name);

        columns[col_name] = {
          column_name: col_name,
          data_type,
          is_nullable,
          default_value: null,
          is_primary_key,
        };
      }

      tables[table_name] = {
        table_name,
        columns,
        primary_keys,
      };
    }
  }

  private infer_sql_type_from_ts_node(
    node: ts.TypeNode,
    has_question_token: boolean
  ): { data_type: string; is_nullable: boolean } {
    let is_nullable = has_question_token;
    let actual_type_node: ts.TypeNode = node;

    if (ts.isUnionTypeNode(node)) {
      const non_null_types: ts.TypeNode[] = [];
      for (const t of node.types) {
        if (t.kind === ts.SyntaxKind.NullKeyword || t.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)) {
          is_nullable = true;
        } else {
          non_null_types.push(t);
        }
      }
      if (non_null_types.length === 1) {
        actual_type_node = non_null_types[0];
      }
    }

    let data_type = "text";
    if (actual_type_node.kind === ts.SyntaxKind.StringKeyword) data_type = "text";
    else if (actual_type_node.kind === ts.SyntaxKind.NumberKeyword) data_type = "integer";
    else if (actual_type_node.kind === ts.SyntaxKind.BooleanKeyword) data_type = "boolean";
    else if (ts.isTypeReferenceNode(actual_type_node)) {
      const ref_name = actual_type_node.typeName.getText();
      if (ref_name === "Date") data_type = "timestamp";
      else data_type = ref_name.toLowerCase();
    }

    return { data_type, is_nullable };
  }

  private are_types_compatible(ts_type: string, sql_type: string): boolean {
    const ts_norm = ts_type.toLowerCase();
    const sql_norm = sql_type.toLowerCase();

    if (ts_norm === sql_norm) return true;

    if (ts_norm === "string" || ts_norm === "text") {
      return ["text", "varchar", "char", "uuid", "date", "time", "timestamp", "timestamptz", "json", "jsonb"].includes(sql_norm);
    }
    if (ts_norm === "number" || ts_norm === "integer") {
      return ["int", "integer", "bigint", "smallint", "numeric", "decimal", "real", "double precision", "float", "float8", "float4"].includes(sql_norm);
    }
    if (ts_norm === "boolean" || ts_norm === "bool") {
      return ["bool", "boolean"].includes(sql_norm);
    }

    return false;
  }
}

export const supabase_drift_detector = new SupabaseDriftDetector();
