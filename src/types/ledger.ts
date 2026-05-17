/**
 * BugBouncer Ledger Worker Message Types
 *
 * MANDATORY CONVENTION: All keys MUST be in snake_case.
 * These types define the postMessage contract between
 * the Causal Kernel (main thread) and the Ledger Worker.
 */

import type { TraceMetadata } from "./trace";

// ──────────────────────────────────────────────
// Worker Command Types (Main Thread → Worker)
// ──────────────────────────────────────────────

export type LedgerCommand =
  | LedgerInsertCommand
  | LedgerQueryCommand
  | LedgerFlushCommand
  | LedgerStatusCommand
  | LedgerSaveProjectCommand
  | LedgerIndexSchemaCommand
  | LedgerSearchSchemaCommand;

export interface LedgerInsertCommand {
  command_type: "insert_trace";
  request_id: string;
  trace: TraceMetadata;
}

export interface LedgerQueryCommand {
  command_type: "query_traces";
  request_id: string;
  filters?: {
    event_type?: TraceMetadata["event_type"];
    min_stability_score?: number;
    max_stability_score?: number;
    since_timestamp_nanos?: number;
    limit?: number;
    user_id?: string | null;
  };
}

export interface LedgerFlushCommand {
  command_type: "flush";
  request_id: string;
}

export interface LedgerStatusCommand {
  command_type: "status";
  request_id: string;
}

export interface LedgerSaveProjectCommand {
  command_type: "save_project";
  request_id: string;
  project_id: string;
  framework: string;
  auth_provider: string;
  database_provider: string;
}

export interface LedgerIndexSchemaCommand {
  command_type: "index_schema";
  request_id: string;
  project_id: string;
  file_path: string;
  content: string;
}

export interface LedgerSearchSchemaCommand {
  command_type: "search_schema";
  request_id: string;
  project_id: string;
  query: string;
  limit?: number;
}

// ──────────────────────────────────────────────
// Worker Response Types (Worker → Main Thread)
// ──────────────────────────────────────────────

export type LedgerResponse =
  | LedgerInsertResponse
  | LedgerQueryResponse
  | LedgerFlushResponse
  | LedgerStatusResponse
  | LedgerErrorResponse
  | LedgerReadyResponse
  | LedgerSaveProjectResponse
  | LedgerIndexSchemaResponse
  | LedgerSearchSchemaResponse;

export interface LedgerInsertResponse {
  response_type: "insert_ok";
  request_id: string;
  trace_id: string;
}

export interface LedgerQueryResponse {
  response_type: "query_result";
  request_id: string;
  traces: TraceMetadata[];
  total_count: number;
}

export interface LedgerFlushResponse {
  response_type: "flush_ok";
  request_id: string;
}

export interface LedgerStatusResponse {
  response_type: "status_ok";
  request_id: string;
  row_count: number;
  db_size_bytes: number;
  is_encrypted: boolean;
}

export interface LedgerErrorResponse {
  response_type: "error";
  request_id: string;
  error_message: string;
  error_code: string;
}

export interface LedgerReadyResponse {
  response_type: "ready";
  request_id: "init";
  is_opfs: boolean;
  is_encrypted: boolean;
}

export interface LedgerSaveProjectResponse {
  response_type: "save_project_ok";
  request_id: string;
}

export interface LedgerIndexSchemaResponse {
  response_type: "index_schema_ok";
  request_id: string;
}

export interface SearchResult {
  file_path: string;
  content: string;
  rank: number;
}

export interface LedgerSearchSchemaResponse {
  response_type: "search_schema_result";
  request_id: string;
  results: SearchResult[];
}
