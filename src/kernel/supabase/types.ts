/**
 * BugBouncer Supabase Drift Detection Types
 *
 * MANDATORY CONVENTION: All keys and properties MUST be in snake_case.
 * These interfaces define the structural contracts for live Supabase schema
 * introspection, local AST schema parsing, and drift comparison results.
 */

export interface ColumnDefinition {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
}

export interface TableDefinition {
  table_name: string;
  columns: Record<string, ColumnDefinition>; // Keyed by column_name
  primary_keys: string[];
}

export interface SupabaseSchemaInfo {
  schema_name: string; // e.g., "public"
  tables: Record<string, TableDefinition>; // Keyed by table_name
  fetched_at_iso: string;
  error_message?: string;
}

export type DriftMismatchType =
  | "missing_table"
  | "missing_column"
  | "type_mismatch"
  | "nullability_mismatch";

export interface DriftMismatch {
  mismatch_type: DriftMismatchType;
  table_name: string;
  column_name?: string;
  expected_type?: string;
  actual_type?: string;
  expected_nullable?: boolean;
  actual_nullable?: boolean;
  description: string;
}

export interface SupabaseDriftResult {
  scanned_at_iso: string;
  has_drift: boolean;
  mismatches: DriftMismatch[];
  scanned_tables_count: number;
  error_message?: string;
}
