import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { AuditHistoryManager } from "@/kernel/generator/certification";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

describe("Certification Export API Endpoint Integration Tests", () => {
  let manager: AuditHistoryManager;

  beforeEach(async () => {
    manager = new AuditHistoryManager();
    await manager.clear_history();
  });

  afterEach(async () => {
    await manager.clear_history();
    // clean up any leaked composer_instructions file
    const base_dir = process.cwd();
    const target_path = `${base_dir}/.bugbouncer/composer_instructions.md`.replace(/\\/g, '/');
    if (fs.existsSync(target_path)) {
      fs.unlinkSync(target_path);
    }
  });

  it("POST should successfully save raw markdown report", async () => {
    const report_markdown = `
# Report Header
---
## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions
Instantly resolve:
Step 1. Check hydration.
---
## 📋 Next Steps
    `;

    const mockRequest = {
      json: async () => ({ report_markdown })
    } as unknown as Request;

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.filepath).toBeDefined();

    expect(fs.existsSync(data.filepath)).toBe(true);
    const writtenContent = fs.readFileSync(data.filepath, "utf-8");
    expect(writtenContent).toContain("## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions");
    expect(writtenContent).not.toContain("# Report Header");
  });

  it("POST should load report from audit history database if only audit_id is provided", async () => {
    const report_markdown = `
# Database Report
---
## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions
Extract this text.
---
    `;

    const saved = await manager.save_audit({
      stability_score: 95,
      schema_coverage: 100,
      total_anomalies: 1,
      resolved_anomalies: 0,
      report_markdown
    });

    const mockRequest = {
      json: async () => ({ audit_id: saved.audit_id })
    } as unknown as Request;

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(fs.existsSync(data.filepath)).toBe(true);
    
    const writtenContent = fs.readFileSync(data.filepath, "utf-8");
    expect(writtenContent).toContain("Extract this text.");
  });

  it("POST should return 400 bad request if parameters are completely missing", async () => {
    const mockRequest = {
      json: async () => ({})
    } as unknown as Request;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("report_markdown or a valid audit_id is required");
  });
});
