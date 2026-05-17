/**
 * BugBouncer Kernel Bridge — Ledger Client
 *
 * Provides the main-thread interface for the Causal Kernel
 * to communicate with the Ledger Web Worker. All commands
 * are fire-and-forget with Promise-based response tracking.
 *
 * Usage:
 *   const client = new LedgerClient();
 *   await client.ready();
 *   await client.insert_trace(trace);
 *   const results = await client.query_traces({ event_type: "error" });
 */

import type { TraceMetadata } from "@/types/trace";
import type {
  LedgerCommand,
  LedgerResponse,
  LedgerQueryCommand,
  LedgerReadyResponse,
  SearchResult,
} from "@/types/ledger";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000;

// ──────────────────────────────────────────────
// Ledger Client
// ──────────────────────────────────────────────

export class LedgerClient {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    {
      resolve: (value: LedgerResponse) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private ready_promise: Promise<LedgerReadyResponse>;
  private resolve_ready!: (value: LedgerReadyResponse) => void;
  private reject_ready!: (reason: Error) => void;
  private is_destroyed = false;

  constructor() {
    // Set up the ready promise before starting the worker
    this.ready_promise = new Promise((resolve, reject) => {
      this.resolve_ready = resolve;
      this.reject_ready = reject;
    });

    this.spawn_worker();
  }

  /**
   * Spawns the Ledger Web Worker.
   * Uses the standard Next.js/Turbopack worker instantiation pattern.
   */
  private spawn_worker(): void {
    try {
      this.worker = new Worker(
        new URL("../../../workers/ledger.worker.ts", import.meta.url),
        { type: "module" }
      );

      this.worker.onmessage = (event: MessageEvent<LedgerResponse>) => {
        this.handle_response(event.data);
      };

      this.worker.onerror = (event: ErrorEvent) => {
        console.error("[ledger-client] Worker error:", event.message);
        this.reject_ready(new Error(`Worker error: ${event.message}`));
      };
    } catch (err) {
      console.error("[ledger-client] Failed to spawn worker:", err);
      this.reject_ready(
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Routes incoming worker responses to the correct pending promise.
   */
  private handle_response(response: LedgerResponse): void {
    // Handle the special "ready" signal from bootstrap
    if (response.response_type === "ready") {
      this.resolve_ready(response as LedgerReadyResponse);
      return;
    }

    const pending = this.pending.get(response.request_id);
    if (!pending) {
      console.warn(
        "[ledger-client] Received response for unknown request_id:",
        response.request_id
      );
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.request_id);

    if (response.response_type === "error") {
      pending.reject(new Error(response.error_message));
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Sends a command to the worker and returns a typed Promise.
   */
  private send<T extends LedgerResponse>(
    command: LedgerCommand,
    timeout_ms = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    if (this.is_destroyed || !this.worker) {
      return Promise.reject(new Error("LedgerClient has been destroyed"));
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.request_id);
        reject(
          new Error(
            `Ledger command '${command.command_type}' timed out after ${timeout_ms}ms`
          )
        );
      }, timeout_ms);

      this.pending.set(command.request_id, {
        resolve: resolve as (value: LedgerResponse) => void,
        reject,
        timer,
      });

      this.worker!.postMessage(command);
    });
  }

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  /**
   * Resolves when the worker has finished bootstrapping SQLite + crypto.
   * Call this before sending any commands.
   */
  async ready(): Promise<LedgerReadyResponse> {
    return this.ready_promise;
  }

  /**
   * Inserts a trace into the ledger.
   * The worker encrypts the payload before writing to SQLite.
   */
  async insert_trace(trace: TraceMetadata): Promise<string> {
    const response = await this.send({
      command_type: "insert_trace",
      request_id: crypto.randomUUID(),
      trace,
    });

    if (response.response_type !== "insert_ok") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }
    return response.trace_id;
  }

  /**
   * Queries traces from the ledger with optional filters.
   * The worker decrypts payloads before returning.
   */
  async query_traces(
    filters?: LedgerQueryCommand["filters"]
  ): Promise<{ traces: TraceMetadata[]; total_count: number }> {
    const response = await this.send({
      command_type: "query_traces",
      request_id: crypto.randomUUID(),
      filters,
    });

    if (response.response_type !== "query_result") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }
    return {
      traces: response.traces,
      total_count: response.total_count,
    };
  }

  /**
   * Forces a WAL checkpoint to persist all pending writes.
   * Call this during kernel panic flush or before shutdown.
   */
  async flush(): Promise<void> {
    await this.send({
      command_type: "flush",
      request_id: crypto.randomUUID(),
    });
  }

  /**
   * Returns the current status of the ledger (row count, DB size, encryption state).
   */
  async status(): Promise<{
    row_count: number;
    db_size_bytes: number;
    is_encrypted: boolean;
  }> {
    const response = await this.send({
      command_type: "status",
      request_id: crypto.randomUUID(),
    });

    if (response.response_type !== "status_ok") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }
    return {
      row_count: response.row_count,
      db_size_bytes: response.db_size_bytes,
      is_encrypted: response.is_encrypted,
    };
  }

  /**
   * Saves project metadata for local RAG indexing.
   */
  async save_project(
    project_id: string,
    framework: string,
    auth_provider: string,
    database_provider: string
  ): Promise<void> {
    const response = await this.send({
      command_type: "save_project",
      request_id: crypto.randomUUID(),
      project_id,
      framework,
      auth_provider,
      database_provider,
    });

    if (response.response_type !== "save_project_ok") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }
  }

  /**
   * Indexes a schema file content into the local FTS5 RAG.
   */
  async index_schema(
    project_id: string,
    file_path: string,
    content: string
  ): Promise<void> {
    const response = await this.send({
      command_type: "index_schema",
      request_id: crypto.randomUUID(),
      project_id,
      file_path,
      content,
    });

    if (response.response_type !== "index_schema_ok") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }
  }

  /**
   * Searches the indexed schemas using FTS5 MATCH.
   */
  async search_schema(
    project_id: string,
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const response = await this.send({
      command_type: "search_schema",
      request_id: crypto.randomUUID(),
      project_id,
      query,
      limit,
    });

    if (response.response_type !== "search_schema_result") {
      throw new Error(`Unexpected response: ${response.response_type}`);
    }

    return response.results;
  }

  /**
   * Gracefully shuts down the worker.
   * Flushes pending writes before termination.
   */
  async destroy(): Promise<void> {
    if (this.is_destroyed) return;

    try {
      await this.flush();
    } catch {
      // Best-effort flush; don't block termination
    }

    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("LedgerClient destroyed"));
      this.pending.delete(id);
    }

    this.worker?.terminate();
    this.worker = null;
    this.is_destroyed = true;
  }
}
