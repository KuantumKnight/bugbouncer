/**
 * BugBouncer Ledger DB — Initialization
 *
 * Handles SQLite database creation, schema migration,
 * and lifecycle management. This module is imported by
 * the Ledger Worker and runs inside the Worker context.
 */

import { TRACE_TABLE_DDL, TRACE_INDEX_DDL } from "@/ledger/schema/trace";

// ──────────────────────────────────────────────
// Types for the sqlite3 WASM API (minimal surface)
// ──────────────────────────────────────────────

/**
 * Minimal type declarations for the @sqlite.org/sqlite-wasm API.
 * We only type what we actually use to keep the surface small.
 */
export interface Sqlite3Database {
  exec(sql: string): void;
  exec(opts: {
    sql: string;
    bind?: unknown[];
    returnValue?: string;
    rowMode?: string;
    callback?: (row: Record<string, unknown>) => void;
  }): unknown;
  close(): void;
  filename: string;
}

export interface Sqlite3Module {
  oo1: {
    OpfsDb: new (filename: string) => Sqlite3Database;
    DB: new (filename?: string) => Sqlite3Database;
  };
  opfs?: unknown;
}

// ──────────────────────────────────────────────
// Database Initialization
// ──────────────────────────────────────────────

const DB_FILENAME = "/bugbouncer-ledger.sqlite3";

/**
 * Initializes the SQLite database using OPFS persistence.
 * Falls back to in-memory if OPFS is unavailable (dev/testing).
 *
 * @param sqlite3 The initialized sqlite3 module from @sqlite.org/sqlite-wasm.
 * @returns An object containing the database handle and whether OPFS is active.
 */
export function init_database(sqlite3: Sqlite3Module): {
  db: Sqlite3Database;
  is_opfs: boolean;
} {
  let db: Sqlite3Database;
  let is_opfs = false;

  // Attempt OPFS-backed database first
  if (sqlite3.opfs) {
    try {
      db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
      is_opfs = true;
    } catch (err) {
      console.warn(
        "[ledger/init] OPFS unavailable, falling back to in-memory:",
        err
      );
      db = new sqlite3.oo1.DB();
    }
  } else {
    console.warn("[ledger/init] OPFS not supported, using in-memory database.");
    db = new sqlite3.oo1.DB();
  }

  // Run schema migrations
  run_migrations(db);

  return { db, is_opfs };
}

/**
 * Applies the schema DDL and indexes.
 * Uses IF NOT EXISTS so this is idempotent.
 */
function run_migrations(db: Sqlite3Database): void {
  db.exec(TRACE_TABLE_DDL);

  // SQLite requires each CREATE INDEX to be a separate statement
  const index_statements = TRACE_INDEX_DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of index_statements) {
    db.exec(stmt);
  }

  // WAL mode for better concurrent read performance from the bridge
  db.exec("PRAGMA journal_mode=WAL;");

  console.log("[ledger/init] Schema migrations applied successfully.");
}
