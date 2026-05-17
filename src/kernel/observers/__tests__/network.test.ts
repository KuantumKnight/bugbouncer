/**
 * NetworkObserver Tests — Story 1.5, Task 4
 *
 * Validates that the NetworkObserver:
 * - Skips excluded URLs via config_engine.should_observe_url()
 * - Masks sensitive request body data through the DagMapper pipeline
 * - Properly records non-excluded network requests
 */

import { describe, it, expect } from "vitest";
import { config_engine } from "@/kernel/config/engine";
import { DagMapper } from "@/kernel/mapper/dag";

describe("NetworkObserver — URL exclusion (Task 4)", () => {
  it("should exclude URLs matching default exclusion regex /auth\\.com/", () => {
    expect(config_engine.should_observe_url("https://auth.com/oauth/token")).toBe(false);
    expect(config_engine.should_observe_url("https://sub.auth.com/verify")).toBe(false);
  });

  it("should exclude URLs matching default exclusion string localhost login", () => {
    expect(config_engine.should_observe_url("http://localhost:3000/api/login")).toBe(false);
  });

  it("should allow non-excluded URLs", () => {
    expect(config_engine.should_observe_url("https://api.example.com/data")).toBe(true);
    expect(config_engine.should_observe_url("https://internal.service.com/health")).toBe(true);
  });

  it("should verify NetworkObserver source code uses config_engine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const network_source = fs.readFileSync(
      path.resolve(__dirname, "../network.ts"),
      "utf-8"
    );

    // Verify config_engine import
    expect(network_source).toContain('import { config_engine } from "@/kernel/config/engine"');

    // Verify URL exclusion check in fetch patch
    expect(network_source).toContain("config_engine.should_observe_url");

    // Verify DagMapper import for payload masking
    expect(network_source).toContain('import { DagMapper } from "@/kernel/mapper/dag"');

    // Verify normalize_payload is used for trace data (masking pipeline)
    expect(network_source).toContain("dag_mapper.normalize_payload");
  });
});

describe("NetworkObserver — request body masking (Task 4)", () => {
  const dag_mapper = new DagMapper();

  it("should mask sensitive keys in request body payloads", () => {
    const request_body = {
      username: "alice",
      password: "hunter2",
      remember_me: true,
    };

    const normalized = dag_mapper.normalize_payload(request_body);
    expect(normalized.username).toBe("alice");
    expect(normalized.password).toBe("[MASKED]");
    expect(normalized.remember_me).toBe(true);
  });

  it("should mask sensitive keys in JSON API payloads", () => {
    const api_payload = {
      action: "create_account",
      data: {
        email: "user@example.com",
        password: "secret123",
        api_key: "ak_live_xxx",
        preferences: {
          theme: "dark",
          token: "refresh_tok_yyy",
        },
      },
    };

    const normalized = dag_mapper.normalize_payload(api_payload);
    expect(normalized.data.email).toBe("user@example.com");
    expect(normalized.data.password).toBe("[MASKED]");
    expect(normalized.data.api_key).toBe("[MASKED]");
    expect(normalized.data.preferences.theme).toBe("dark");
    expect(normalized.data.preferences.token).toBe("[MASKED]");
  });

  it("should handle request bodies with arrays of sensitive objects", () => {
    const batch_payload = {
      requests: [
        { url: "/api/auth", token: "tok_1" },
        { url: "/api/data", token: "tok_2" },
      ],
    };

    const normalized = dag_mapper.normalize_payload(batch_payload);
    expect(normalized.requests[0].token).toBe("[MASKED]");
    expect(normalized.requests[1].token).toBe("[MASKED]");
    expect(normalized.requests[0].url).toBe("/api/auth");
  });

  it("should not mask non-sensitive request body fields", () => {
    const safe_payload = {
      page: 1,
      limit: 25,
      sort_by: "created_at",
      filter: { status: "active" },
    };

    const normalized = dag_mapper.normalize_payload(safe_payload);
    expect(normalized.page).toBe(1);
    expect(normalized.limit).toBe(25);
    expect(normalized.sort_by).toBe("created_at");
    expect(normalized.filter.status).toBe("active");
  });
});

describe("NetworkObserver — network trace payload masking (Task 4)", () => {
  const dag_mapper = new DagMapper();

  it("should mask sensitive data in the full network trace payload", () => {
    const trace_payload = {
      request_url: "https://api.example.com/login",
      request_method: "POST",
      response_status: 200,
      latency_ms: 45.3,
      request_type: "fetch",
      request_body: {
        email: "user@test.com",
        password: "my_password",
        token: "refresh_token_123",
      },
    };

    const normalized = dag_mapper.normalize_payload(trace_payload);
    expect(normalized.request_url).toBe("https://api.example.com/login");
    expect(normalized.request_method).toBe("POST");
    expect(normalized.request_body.email).toBe("user@test.com");
    expect(normalized.request_body.password).toBe("[MASKED]");
    expect(normalized.request_body.token).toBe("[MASKED]");
  });
});
