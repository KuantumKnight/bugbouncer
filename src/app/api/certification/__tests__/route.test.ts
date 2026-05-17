import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST, GET, DELETE } from "../route";
import { AuditHistoryManager } from "@/kernel/generator/certification";

describe("Certification API Endpoint Integration Tests", () => {
  let manager: AuditHistoryManager;

  beforeEach(async () => {
    manager = new AuditHistoryManager();
    await manager.clear_history();
  });

  afterEach(async () => {
    await manager.clear_history();
  });

  it("POST should successfully generate a report and record, and redact sensitive data", async () => {
    const payload = {
      project_id: "proj_bugbouncer_causal",
      framework: "Next.js 16",
      auth_provider: "Clerk v6",
      database_provider: "Supabase Schema",
      anomalies: [
        {
          anomaly_type: "hydration_mismatch",
          component_name: "AuthButton",
          fiber_id: "fib_auth",
          expected_state: '{"user":"sarvesh.m@vitstudent.ac.in"}',
          actual_state: '{"user":null}',
          schema_hash: "sh_hash",
          timestamp: Date.now()
        }
      ],
      resolved_anomalies: [
        {
          anomaly: {
            anomaly_type: "void_payload",
            target_field: "api_token",
            regex_pattern: ".*",
            injected_value: "sk_live_abcdef1234567890abcdef12",
            timestamp: Date.now()
          },
          fix_applied: "usePayloadSanitizer"
        }
      ],
      schema_coverage: 95,
      seed: "test-seed-123"
    };

    const mockRequest = {
      json: async () => payload
    } as unknown as Request;

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.record).toBeDefined();
    expect(data.report).toBeDefined();

    // Verify metadata properties saved
    expect(data.record.stability_score).toBeDefined();
    expect(data.record.schema_coverage).toBe(95);
    expect(data.record.total_anomalies).toBe(1);
    expect(data.record.resolved_anomalies).toBe(1);

    // Verify redactions performed in the generated report
    expect(data.report).toContain("[REDACTED_EMAIL]");
    expect(data.report).toContain("[REDACTED_API_KEY]");
    expect(data.report).not.toContain("sarvesh.m@");
    expect(data.report).not.toContain("sk_live_abcdef");

    // Retrieve history using a FRESH manager to ensure it reads from disk
    // (the POST handler uses its own instance that writes to the filesystem)
    const verifier = new AuditHistoryManager();
    const history = await verifier.get_audit_history();
    expect(history.length).toBe(1);
    expect(history[0].audit_id).toBe(data.record.audit_id);
  });

  it("POST should return 400 when project_id is missing", async () => {
    const mockRequest = {
      json: async () => ({})
    } as unknown as Request;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("project_id is required");
  });

  it("GET should retrieve the history list correctly", async () => {
    // Manually seed one record
    await manager.save_audit({
      stability_score: 98,
      schema_coverage: 100,
      total_anomalies: 0,
      resolved_anomalies: 1,
      report_markdown: "# Pre-seeded Report"
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const history = await response.json();
    expect(history.length).toBe(1);
    expect(history[0].stability_score).toBe(98);
    expect(history[0].report_markdown).toBe("# Pre-seeded Report");
  });

  it("DELETE should clear history successfully", async () => {
    // Seed
    await manager.save_audit({
      stability_score: 98,
      schema_coverage: 100,
      total_anomalies: 0,
      resolved_anomalies: 1,
      report_markdown: "# Pre-seeded Report"
    });

    const response = await DELETE();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    const history = await manager.get_audit_history();
    expect(history.length).toBe(0);
  });
});
