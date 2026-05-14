/**
 * BugBouncer Network Observer
 * 
 * Intercepts browser-level network traffic (fetch and XHR) to capture
 * observability data and inject trace contexts.
 */

import { causal_context } from "@/kernel/context";
import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { TraceMetadata } from "@/types/trace";
import { config_engine } from "@/kernel/config/engine";
import { DagMapper } from "@/kernel/mapper/dag";

export class NetworkObserver {
  private ledger_client: LedgerClient;
  private dag_mapper: DagMapper;
  private is_active = false;

  constructor(ledger_client: LedgerClient) {
    this.ledger_client = ledger_client;
    this.dag_mapper = new DagMapper();
  }

  public activate(): void {
    if (typeof window === "undefined" || this.is_active) return;

    this.patch_fetch();
    this.patch_xhr();
    this.is_active = true;
    console.log("[network-observer] Network interception active.");
  }

  private patch_fetch(): void {
    const original_fetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      
      if (!config_engine.should_observe_url(url)) {
        return original_fetch(input, init);
      }

      const start_time = performance.now();
      const trace_id = causal_context.get_trace_id();
      const span_id = `net-fetch-${crypto.randomUUID().slice(0, 8)}`;

      // Inject Header
      const headers = new Headers(init?.headers || {});
      headers.set("x-bugbouncer-trace-id", trace_id);
      
      const new_init = { ...init, headers };

      try {
        const response = await original_fetch(input, new_init);
        const end_time = performance.now();

        this.record_request({
          trace_id,
          span_id,
          url: input.toString(),
          method: init?.method || "GET",
          status: response.status,
          duration_ms: end_time - start_time,
          type: "fetch"
        });

        return response;
      } catch (error) {
        const end_time = performance.now();
        this.record_request({
          trace_id,
          span_id,
          url: input.toString(),
          method: init?.method || "GET",
          status: 0,
          duration_ms: end_time - start_time,
          type: "fetch",
          error: String(error)
        });
        throw error;
      }
    };
  }

  private patch_xhr(): void {
    const self = this;
    const original_open = XMLHttpRequest.prototype.open;
    const original_send = XMLHttpRequest.prototype.send;

    (XMLHttpRequest.prototype as any).open = function(method: string, url: string | URL) {
      const url_str = url.toString();
      if (!config_engine.should_observe_url(url_str)) {
        this.__bugbouncer_ignored = true;
        return original_open.apply(this, arguments as any);
      }

      this.__bugbouncer_meta = {
        method,
        url: url_str,
        start_time: performance.now(),
        trace_id: causal_context.get_trace_id(),
        span_id: `net-xhr-${crypto.randomUUID().slice(0, 8)}`
      };
      return original_open.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function() {
      if ((this as any).__bugbouncer_ignored) {
        return original_send.apply(this, arguments as any);
      }
      const meta = (this as any).__bugbouncer_meta;
      if (meta) {
        this.setRequestHeader("x-bugbouncer-trace-id", meta.trace_id);
        
        this.addEventListener("loadend", () => {
          const end_time = performance.now();
          self.record_request({
            trace_id: meta.trace_id,
            span_id: meta.span_id,
            url: meta.url,
            method: meta.method,
            status: this.status,
            duration_ms: end_time - meta.start_time,
            type: "xhr"
          });
        });
      }
      return original_send.apply(this, arguments as any);
    };
  }

  private record_request(data: {
    trace_id: string;
    span_id: string;
    url: string;
    method: string;
    status: number;
    duration_ms: number;
    type: "fetch" | "xhr";
    error?: string;
  }): void {
    const timestamp = performance.now() * 1_000_000;

    const trace: TraceMetadata = {
      trace_id: data.trace_id,
      span_id: data.span_id,
      timestamp_nanos: Math.floor(timestamp),
      event_type: "network_request",
      payload: this.dag_mapper.normalize_payload({
        request_url: data.url,
        request_method: data.method,
        response_status: data.status,
        latency_ms: data.duration_ms,
        request_type: data.type,
        error_message: data.error
      }) as any,
      stability_score: data.status >= 400 || data.error ? 0.0 : 1.0,
      is_panic_event: data.status >= 500
    };

    this.ledger_client.insert_trace(trace);
  }
}
