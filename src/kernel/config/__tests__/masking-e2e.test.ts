/**
 * End-to-End Masking Verification — Story 1.5, Task 5
 *
 * Validates that the full pipeline (ConfigEngine → DagMapper → TraceMetadata)
 * ensures sensitive data is NEVER present in cleartext in the final trace
 * payload that would be persisted to the SQLite ledger.
 *
 * AC4: Sensitive Field Masking for props/payloads.
 * AC5: Configuration readable at runtime.
 */

import { describe, it, expect } from "vitest";
import { config_engine } from "@/kernel/config/engine";
import { DagMapper } from "@/kernel/mapper/dag";
import type { TraceMetadata } from "@/types/trace";

describe("Task 5: Ledger Masking Verification", () => {
  const dag_mapper = new DagMapper();

  /**
   * Recursively scans a payload object for any cleartext sensitive values.
   * Returns an array of paths where unmasked sensitive data was found.
   */
  function find_unmasked_sensitive_data(
    obj: unknown,
    sensitive_keys: string[],
    path = ""
  ): string[] {
    const violations: string[] = [];
    if (!obj || typeof obj !== "object") return violations;

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        violations.push(
          ...find_unmasked_sensitive_data(item, sensitive_keys, `${path}[${i}]`)
        );
      });
      return violations;
    }

    const record = obj as Record<string, unknown>;
    for (const key in record) {
      const current_path = path ? `${path}.${key}` : key;
      const val = record[key];
      if (sensitive_keys.includes(key.toLowerCase()) && val !== "[MASKED]") {
        violations.push(`${current_path} = ${JSON.stringify(val)}`);
      }
      if (typeof val === "object") {
        violations.push(
          ...find_unmasked_sensitive_data(val, sensitive_keys, current_path)
        );
      }
    }
    return violations;
  }

  it("should mask all sensitive fields in a fiber_update trace payload", () => {
    const raw_fiber_payload = {
      component_name: "LoginForm",
      props: {
        username: "alice",
        password: "supersecret",
        onSubmit: "function",
      },
      duration_ms: 2.5,
      fiber_tag: 0,
    };

    const normalized = dag_mapper.normalize_payload(raw_fiber_payload);

    const violations = find_unmasked_sensitive_data(
      normalized,
      config_engine.get_sensitive_keys()
    );
    expect(violations).toEqual([]);
    expect(normalized.props.password).toBe("[MASKED]");
    expect(normalized.props.username).toBe("alice");
  });

  it("should mask all sensitive fields in a network_request trace payload", () => {
    const raw_network_payload = {
      request_url: "https://api.example.com/auth",
      request_method: "POST",
      response_status: 200,
      latency_ms: 32.1,
      request_type: "fetch",
      request_body: {
        email: "user@test.com",
        password: "p@ssw0rd!",
        credit_card: "4111-1111-1111-1111",
        cvv: "123",
        auth: "Bearer tok_xxx",
        nested: {
          api_key: "ak_live_secret",
          ssn: "123-45-6789",
        },
      },
    };

    const normalized = dag_mapper.normalize_payload(raw_network_payload);

    const violations = find_unmasked_sensitive_data(
      normalized,
      config_engine.get_sensitive_keys()
    );
    expect(violations).toEqual([]);

    // Verify specific masking
    expect(normalized.request_body.password).toBe("[MASKED]");
    expect(normalized.request_body.credit_card).toBe("[MASKED]");
    expect(normalized.request_body.cvv).toBe("[MASKED]");
    expect(normalized.request_body.auth).toBe("[MASKED]");
    expect(normalized.request_body.nested.api_key).toBe("[MASKED]");
    expect(normalized.request_body.nested.ssn).toBe("[MASKED]");

    // Verify non-sensitive data preserved
    expect(normalized.request_url).toBe("https://api.example.com/auth");
    expect(normalized.request_body.email).toBe("user@test.com");
  });

  it("should build a complete TraceMetadata object with masked payload", () => {
    const raw_payload = {
      component_name: "PaymentForm",
      props: {
        card_number: "4111111111111111",
        cvv: "999",
        amount: 49.99,
      },
      duration_ms: 1.2,
      fiber_tag: 0,
    };

    const masked_payload = dag_mapper.normalize_payload(raw_payload);

    const trace: TraceMetadata = {
      trace_id: "test-trace-e2e",
      span_id: "span-payment-form",
      timestamp_nanos: Date.now() * 1_000_000,
      event_type: "fiber_update",
      payload: masked_payload as TraceMetadata["payload"],
      stability_score: 1.0,
      is_panic_event: false,
    };

    // Verify the trace object itself contains no cleartext sensitive data
    const violations = find_unmasked_sensitive_data(
      trace.payload,
      config_engine.get_sensitive_keys()
    );
    expect(violations).toEqual([]);
    const trace_payload = trace.payload as { props: Record<string, unknown> };
    expect(trace_payload.props.card_number).toBe("[MASKED]");
    expect(trace_payload.props.cvv).toBe("[MASKED]");
    expect(trace_payload.props.amount).toBe(49.99);
  });

  it("should handle the worst-case scenario: deeply nested sensitive data", () => {
    const nightmare_payload = {
      level1: {
        level2: {
          level3: {
            level4: {
              password: "deep_secret",
              token: "deep_token",
              safe_data: "visible",
            },
          },
        },
      },
      array_of_secrets: [
        { secret: "s1", api_key: "k1" },
        { secret: "s2", api_key: "k2" },
        {
          nested_array: [
            { token: "nested_tok", name: "safe" },
          ],
        },
      ],
    };

    const normalized = dag_mapper.normalize_payload(nightmare_payload);

    const violations = find_unmasked_sensitive_data(
      normalized,
      config_engine.get_sensitive_keys()
    );
    expect(violations).toEqual([]);

    // Spot-check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const norm = normalized as any;
    expect(norm.level1.level2.level3.level4.password).toBe("[MASKED]");
    expect(norm.level1.level2.level3.level4.token).toBe("[MASKED]");
    expect(norm.level1.level2.level3.level4.safe_data).toBe("visible");
    expect(norm.array_of_secrets[0].secret).toBe("[MASKED]");
    expect(norm.array_of_secrets[2].nested_array[0].token).toBe("[MASKED]");
    expect(norm.array_of_secrets[2].nested_array[0].name).toBe("safe");
  });
});
