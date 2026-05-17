/**
 * BugBouncer Ledger Schema — RAG (Project Intake)
 *
 * MANDATORY: All column names are snake_case.
 * Defines the DDL for the project_metadata table and the
 * FTS5 schema_index virtual table used for the private local RAG pipeline.
 */

export const PROJECT_METADATA_TABLE_NAME = "project_metadata";
export const SCHEMA_INDEX_TABLE_NAME = "schema_index";

export const PROJECT_METADATA_DDL = `
  CREATE TABLE IF NOT EXISTS ${PROJECT_METADATA_TABLE_NAME} (
    project_id        TEXT PRIMARY KEY,
    framework         TEXT NOT NULL,
    auth_provider     TEXT NOT NULL,
    database_provider TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// SQLite FTS5 table for fast local schema full-text search
export const SCHEMA_INDEX_DDL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS ${SCHEMA_INDEX_TABLE_NAME} USING fts5(
    file_path,
    content,
    project_id UNINDEXED
  );
`;
