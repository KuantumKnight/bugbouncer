/**
 * BugBouncer Ledger Schema — Trace Table
 *
 * MANDATORY: All column names are snake_case.
 * This module exports the SQL DDL and column definitions
 * used by the Ledger Worker to create and validate the
 * trace_ledger table in SQLite/OPFS.
 */

export const TRACE_TABLE_NAME = "trace_ledger";

export const TRACE_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS ${TRACE_TABLE_NAME} (
    trace_id          TEXT     PRIMARY KEY,
    span_id           TEXT     NOT NULL,
    parent_span_id    TEXT,
    timestamp_nanos   INTEGER  NOT NULL,
    event_type        TEXT     NOT NULL CHECK(event_type IN ('dom_mutation','network_request','fiber_update','error')),
    encrypted_payload BLOB     NOT NULL,
    iv                BLOB     NOT NULL,
    stability_score   REAL     NOT NULL DEFAULT 0.0,
    is_panic_event    INTEGER  NOT NULL DEFAULT 0,
    user_id           TEXT,
    created_at        TEXT     NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * Performance index for time-range queries used by the
 * DAG mapper and Stability Score calculator.
 */
export const TRACE_INDEX_DDL = `
  CREATE INDEX IF NOT EXISTS idx_trace_timestamp
    ON ${TRACE_TABLE_NAME} (timestamp_nanos DESC);

  CREATE INDEX IF NOT EXISTS idx_trace_event_type
    ON ${TRACE_TABLE_NAME} (event_type);

  CREATE INDEX IF NOT EXISTS idx_trace_stability
    ON ${TRACE_TABLE_NAME} (stability_score);

  CREATE INDEX IF NOT EXISTS idx_trace_user_id
    ON ${TRACE_TABLE_NAME} (user_id);
`;

/**
 * Column mapping for runtime validation.
 * Ensures no camelCase keys leak into SQL statements.
 */
export const TRACE_COLUMNS = [
  "trace_id",
  "span_id",
  "parent_span_id",
  "timestamp_nanos",
  "event_type",
  "encrypted_payload",
  "iv",
  "stability_score",
  "is_panic_event",
  "user_id",
  "created_at",
] as const;

export type TraceColumn = (typeof TRACE_COLUMNS)[number];
