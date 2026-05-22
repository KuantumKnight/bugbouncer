/**
 * BugBouncer Ledger Worker
 *
 * Runs in a dedicated Web Worker to access the synchronous OPFS API.
 * Responsibilities:
 *   1. Initialize SQLite with OPFS persistence.
 *   2. Manage the AES-256-GCM encryption key lifecycle.
 *   3. Listen for commands from the Causal Kernel via postMessage.
 *   4. Encrypt trace payloads before insertion; decrypt on retrieval.
 *
 * MANDATORY: All message keys and DB columns are snake_case.
 */

/// <reference lib="webworker" />

import type { TraceMetadata } from "@/types/trace";
import type {
  LedgerCommand,
  LedgerResponse,
  LedgerInsertCommand,
  LedgerQueryCommand,
  LedgerSaveProjectCommand,
  LedgerIndexSchemaCommand,
  LedgerSearchSchemaCommand,
} from "@/types/ledger";
import type { Sqlite3Database, Sqlite3Module } from "@/ledger/db/init";
import { init_database } from "@/ledger/db/init";
import {
  get_or_create_master_key,
  encrypt_payload,
  decrypt_payload,
} from "@/ledger/db/crypto";
import { TRACE_TABLE_NAME } from "@/ledger/schema/trace";
import { PROJECT_METADATA_TABLE_NAME, SCHEMA_INDEX_TABLE_NAME } from "@/ledger/schema/rag";

// ──────────────────────────────────────────────
// Worker State
// ──────────────────────────────────────────────

let db: Sqlite3Database | null = null;
let master_key: CryptoKey | null = null;
let is_opfs = false;

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function post_response(response: LedgerResponse): void {
  self.postMessage(response);
}

function post_error(request_id: string, error: unknown, code = "WORKER_ERROR"): void {
  const error_message =
    error instanceof Error ? error.message : String(error);
  post_response({
    response_type: "error",
    request_id,
    error_message,
    error_code: code,
  });
}

// ──────────────────────────────────────────────
// Command Handlers
// ──────────────────────────────────────────────

async function handle_insert(cmd: LedgerInsertCommand): Promise<void> {
  if (!db || !master_key) {
    post_error(cmd.request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  const trace = cmd.trace;

  // Encrypt the sensitive payload before storage
  const { encrypted_data, iv } = await encrypt_payload(
    master_key,
    trace.payload as Record<string, unknown>
  );

  db.exec({
    sql: `INSERT OR REPLACE INTO ${TRACE_TABLE_NAME}
            (trace_id, span_id, parent_span_id, timestamp_nanos,
             event_type, encrypted_payload, iv, stability_score, is_panic_event, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [
      trace.trace_id,
      trace.span_id,
      trace.parent_span_id ?? null,
      trace.timestamp_nanos,
      trace.event_type,
      encrypted_data,
      iv,
      trace.stability_score,
      trace.is_panic_event ? 1 : 0,
      trace.user_id ?? null,
    ],
  });

  post_response({
    response_type: "insert_ok",
    request_id: cmd.request_id,
    trace_id: trace.trace_id,
  });
}

async function handle_query(cmd: LedgerQueryCommand): Promise<void> {
  if (!db || !master_key) {
    post_error(cmd.request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  const conditions: string[] = [];
  const binds: unknown[] = [];
  const filters = cmd.filters ?? {};

  if (filters.event_type) {
    conditions.push("event_type = ?");
    binds.push(filters.event_type);
  }
  if (filters.min_stability_score !== undefined) {
    conditions.push("stability_score >= ?");
    binds.push(filters.min_stability_score);
  }
  if (filters.max_stability_score !== undefined) {
    conditions.push("stability_score <= ?");
    binds.push(filters.max_stability_score);
  }
  if (filters.since_timestamp_nanos !== undefined) {
    conditions.push("timestamp_nanos >= ?");
    binds.push(filters.since_timestamp_nanos);
  }
  if (filters.user_id !== undefined) {
    if (filters.user_id === null) {
      conditions.push("user_id IS NULL");
    } else {
      conditions.push("user_id = ?");
      binds.push(filters.user_id);
    }
  }

  const where_clause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit_clause = filters.limit ? `LIMIT ${filters.limit}` : "LIMIT 100";

  // Get total count
  const count_rows: { total: number }[] = [];
  db.exec({
    sql: `SELECT COUNT(*) as total FROM ${TRACE_TABLE_NAME} ${where_clause}`,
    bind: binds,
    rowMode: "object",
    callback: (row) => {
      count_rows.push(row as unknown as { total: number });
    },
  });
  const total_count = count_rows[0]?.total ?? 0;

  // Fetch rows
  const raw_rows: Record<string, unknown>[] = [];
  db.exec({
    sql: `SELECT * FROM ${TRACE_TABLE_NAME} ${where_clause}
          ORDER BY timestamp_nanos DESC ${limit_clause}`,
    bind: binds,
    rowMode: "object",
    callback: (row) => {
      raw_rows.push(row as Record<string, unknown>);
    },
  });

  // Decrypt payloads
  const traces: TraceMetadata[] = [];
  for (const row of raw_rows) {
    const decrypted_payload = await decrypt_payload(
      master_key,
      new Uint8Array(row.encrypted_payload as ArrayBuffer),
      new Uint8Array(row.iv as ArrayBuffer)
    );

    traces.push({
      trace_id: row.trace_id as string,
      span_id: row.span_id as string,
      parent_span_id: (row.parent_span_id as string) || undefined,
      timestamp_nanos: row.timestamp_nanos as number,
      event_type: row.event_type as TraceMetadata["event_type"],
      payload: decrypted_payload as TraceMetadata["payload"],
      stability_score: row.stability_score as number,
      is_panic_event: (row.is_panic_event as number) === 1,
      user_id: (row.user_id as string) || undefined,
    });
  }

  post_response({
    response_type: "query_result",
    request_id: cmd.request_id,
    traces,
    total_count,
  });
}

function handle_flush(request_id: string): void {
  if (!db) {
    post_error(request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  // Force WAL checkpoint to persist all pending writes
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");

  post_response({
    response_type: "flush_ok",
    request_id,
  });
}

function handle_status(request_id: string): void {
  if (!db) {
    post_error(request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  const count_rows: { row_count: number }[] = [];
  db.exec({
    sql: `SELECT COUNT(*) as row_count FROM ${TRACE_TABLE_NAME}`,
    rowMode: "object",
    callback: (row) => {
      count_rows.push(row as unknown as { row_count: number });
    },
  });

  const page_count_rows: { page_count: number; page_size: number }[] = [];
  db.exec({
    sql: "SELECT page_count, page_size FROM pragma_page_count(), pragma_page_size()",
    rowMode: "object",
    callback: (row) => {
      page_count_rows.push(
        row as unknown as { page_count: number; page_size: number }
      );
    },
  });

  const row_count = count_rows[0]?.row_count ?? 0;
  const page_info = page_count_rows[0];
  const db_size_bytes = page_info
    ? page_info.page_count * page_info.page_size
    : 0;

  post_response({
    response_type: "status_ok",
    request_id,
    row_count,
    db_size_bytes,
    is_encrypted: master_key !== null,
  });
}

function handle_save_project(cmd: LedgerSaveProjectCommand): void {
  if (!db) {
    post_error(cmd.request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  db.exec({
    sql: `INSERT OR REPLACE INTO ${PROJECT_METADATA_TABLE_NAME}
            (project_id, framework, auth_provider, database_provider)
          VALUES (?, ?, ?, ?)`,
    bind: [cmd.project_id, cmd.framework, cmd.auth_provider, cmd.database_provider],
  });

  post_response({
    response_type: "save_project_ok",
    request_id: cmd.request_id,
  });
}

function handle_index_schema(cmd: LedgerIndexSchemaCommand): void {
  if (!db) {
    post_error(cmd.request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  db.exec({
    sql: `INSERT INTO ${SCHEMA_INDEX_TABLE_NAME}
            (project_id, file_path, content)
          VALUES (?, ?, ?)`,
    bind: [cmd.project_id, cmd.file_path, cmd.content],
  });

  post_response({
    response_type: "index_schema_ok",
    request_id: cmd.request_id,
  });
}

function handle_search_schema(cmd: LedgerSearchSchemaCommand): void {
  if (!db) {
    post_error(cmd.request_id, "Ledger not initialized", "NOT_READY");
    return;
  }

  const results: Array<{ file_path: string; content: string; rank: number }> = [];
  
  db.exec({
    sql: `SELECT file_path, content, rank
          FROM ${SCHEMA_INDEX_TABLE_NAME}
          WHERE project_id = ? AND ${SCHEMA_INDEX_TABLE_NAME} MATCH ?
          ORDER BY rank
          LIMIT ?`,
    bind: [cmd.project_id, cmd.query, cmd.limit ?? 10],
    rowMode: "object",
    callback: (row) => {
      results.push(row as unknown as { file_path: string; content: string; rank: number });
    },
  });

  post_response({
    response_type: "search_schema_result",
    request_id: cmd.request_id,
    results: results.map((r) => ({
      file_path: r.file_path as string,
      content: r.content as string,
      rank: r.rank as number,
    })),
  });
}

// ──────────────────────────────────────────────
// Message Router
// ──────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<LedgerCommand>) => {
  const cmd = event.data;

  try {
    switch (cmd.command_type) {
      case "insert_trace":
        await handle_insert(cmd);
        break;
      case "query_traces":
        await handle_query(cmd);
        break;
      case "flush":
        handle_flush(cmd.request_id);
        break;
      case "status":
        handle_status(cmd.request_id);
        break;
      case "save_project":
        handle_save_project(cmd);
        break;
      case "index_schema":
        handle_index_schema(cmd);
        break;
      case "search_schema":
        handle_search_schema(cmd);
        break;
      default:
        post_error(
          (cmd as LedgerCommand).request_id ?? "unknown",
          `Unknown command_type: ${(cmd as Record<string, string>).command_type}`,
          "UNKNOWN_COMMAND"
        );
    }
  } catch (err) {
    post_error(cmd.request_id, err, "COMMAND_FAILED");
  }
};

// ──────────────────────────────────────────────
// Worker Bootstrap
// ──────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  try {
    // Dynamic import of the sqlite3 WASM module.
    // @sqlite.org/sqlite-wasm exports sqlite3InitModule as default.
    const { default: sqlite3InitModule } = await import(
      /* webpackIgnore: true */
      "@sqlite.org/sqlite-wasm"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlite3 = await (sqlite3InitModule as any)({
      print: console.log,
      printErr: console.error,
    }) as Sqlite3Module;

    const result = init_database(sqlite3);
    db = result.db;
    is_opfs = result.is_opfs;

    // Initialize encryption key
    master_key = await get_or_create_master_key();

    console.log(
      `[ledger.worker] Ready — OPFS: ${is_opfs}, Encrypted: ${master_key !== null}`
    );

    post_response({
      response_type: "ready",
      request_id: "init",
      is_opfs,
      is_encrypted: master_key !== null,
    });
  } catch (err) {
    console.error("[ledger.worker] Bootstrap failed:", err);
    post_error("init", err, "BOOTSTRAP_FAILED");
  }
}

bootstrap();
//tf is bootstrap??
