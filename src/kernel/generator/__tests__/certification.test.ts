import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  redact_sensitive_data,
  calculate_stability_score,
  generate_certification_report,
  AuditHistoryManager,
  CertificationReportOptions
} from '../certification';
import { FuzzerAnomaly } from '../../fuzzer/types';

describe('Grade A Certification Report & Exporter', () => {
  describe('redact_sensitive_data', () => {
    it('should redact authorization headers and bearer tokens', () => {
      const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIn0.signature';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('eyJhbGci');
      expect(redacted).toContain('Authorization: Bearer [REDACTED_AUTH_TOKEN]');
    });

    it('should redact bare JWT tokens', () => {
      const raw = 'The user token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIn0.signature_here';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('eyJhbGci');
      expect(redacted).toContain('[REDACTED_JWT]');
    });

    it('should redact Supabase keys and API keys', () => {
      const raw = 'supabase_key = "sb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0" and stripe_key = "sk_live_123456789012345678901234"';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('sb_a1b2c3d4e5f6');
      expect(redacted).not.toContain('sk_live_12345');
      expect(redacted).toContain('[REDACTED_SUPABASE_KEY]');
      expect(redacted).toContain('[REDACTED_API_KEY]');
    });

    it('should redact emails', () => {
      const raw = 'Send notifications to sarvesh.m@vitstudent.ac.in or lead.engineer@bugbouncer.io';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('sarvesh.m@');
      expect(redacted).not.toContain('lead.engineer@');
      expect(redacted).toContain('[REDACTED_EMAIL]');
    });

    it('should redact key-value secrets in JSON-like structures', () => {
      const raw = '{"db_password": "super_secret_123", "api_key": "mysecretkey"}';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('super_secret_123');
      expect(redacted).not.toContain('mysecretkey');
      expect(redacted).toContain('"db_password": "[REDACTED]"');
      expect(redacted).toContain('"api_key": "[REDACTED]"');
    });

    it('should redact secrets in URL queries', () => {
      const raw = 'http://localhost:3000/api/callback?code=123&api_key=myapikey123&password=hunter2';
      const redacted = redact_sensitive_data(raw);
      expect(redacted).not.toContain('myapikey123');
      expect(redacted).not.toContain('hunter2');
      expect(redacted).toContain('api_key=[REDACTED]');
      expect(redacted).toContain('password=[REDACTED]');
    });
  });

  describe('calculate_stability_score', () => {
    it('should return 100 for zero anomalies and 100% schema coverage', () => {
      const score = calculate_stability_score([], 100);
      expect(score).toBe(100);
    });

    it('should deduct points for fuzzer anomalies', () => {
      const anomalies: FuzzerAnomaly[] = [
        {
          anomaly_type: 'hydration_mismatch',
          component_name: 'Navbar',
          fiber_id: '1',
          expected_state: 'true',
          actual_state: 'false',
          schema_hash: 'h1',
          timestamp: Date.now()
        },
        {
          anomaly_type: 'coherence_failure',
          dependency_id: 'supabase_client',
          affected_fibers: ['1', '2'],
          divergence_delta_ms: 120,
          timestamp: Date.now()
        }
      ];

      // hydration (-10) + coherence (-15) = 25 point deduction. base = 75.
      // schema_coverage = 100 -> factor = 1.0 -> weighted_score = 75 * 1.0 = 75
      const score = calculate_stability_score(anomalies, 100);
      expect(score).toBe(75);
    });

    it('should penalize for low schema coverage', () => {
      // zero anomalies. base = 100.
      // schema_coverage = 50 -> factor = 0.5 -> weighted_score = 100 * (0.7 + 0.3 * 0.5) = 85.
      const score = calculate_stability_score([], 50);
      expect(score).toBe(85);
    });

    it('should clamp deductions at 0', () => {
      const anomalies: FuzzerAnomaly[] = Array(10).fill({
        anomaly_type: 'coherence_failure',
        dependency_id: 'dep',
        affected_fibers: [],
        divergence_delta_ms: 100,
        timestamp: Date.now()
      });

      const score = calculate_stability_score(anomalies, 100);
      expect(score).toBe(0);
    });
  });

  describe('generate_certification_report', () => {
    it('should produce a richly formatted Notion-compatible report with redacted secrets', () => {
      const options: CertificationReportOptions = {
        project_id: 'proj_4044',
        framework: 'Next.js 16',
        auth_provider: 'Clerk v6',
        database_provider: 'Supabase',
        seed: 'test-seed-123',
        schema_coverage: 95,
        anomalies: [
          {
            anomaly_type: 'hydration_mismatch',
            component_name: 'AuthButton',
            fiber_id: 'fib_auth',
            expected_state: '{"user":"sarvesh.m@vitstudent.ac.in"}', // contains email
            actual_state: '{"user":null}',
            schema_hash: 'sh_hash',
            timestamp: Date.now()
          }
        ],
        resolved_anomalies: [
          {
            anomaly: {
              anomaly_type: 'void_payload',
              target_field: 'api_token',
              regex_pattern: '.*',
              injected_value: 'sk_live_abcdef1234567890abcdef12', // secret
              timestamp: Date.now()
            },
            fix_applied: 'usePayloadSanitizer'
          }
        ]
      };

      const report = generate_certification_report(options);

      // Check structures
      expect(report).toContain('# BugBouncer Stability Certification Report');
      expect(report).toContain('BUGBOUNCER STABILITY STATUS: GRADE');
      expect(report).toContain('Toggle specs details'); // details check
      expect(report).toContain('| Property | Value |'); // GFM specifications table
      expect(report).toContain('## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions'); // NFR-I2
      expect(report).toContain('](src/components/AuthButton.tsx)'); // file relative link

      // Check redactions:
      expect(report).not.toContain('sarvesh.m@');
      expect(report).not.toContain('sk_live_abcdef');
      expect(report).toContain('[REDACTED_EMAIL]');
      expect(report).toContain('[REDACTED_API_KEY]');
    });
  });

  describe('AuditHistoryManager', () => {
    let manager: AuditHistoryManager;

    beforeEach(async () => {
      manager = new AuditHistoryManager();
      // Ensure clean state before each test
      await manager.clear_history();
    });

    afterEach(async () => {
      // Clean up after each test
      await manager.clear_history();
    });

    it('should save and retrieve audit history records', async () => {
      const record = await manager.save_audit({
        stability_score: 95,
        schema_coverage: 100,
        total_anomalies: 1,
        resolved_anomalies: 1,
        report_markdown: '# Test Report'
      });

      expect(record.audit_id).toMatch(/^AUD-[A-Z0-9]{8}$/);
      expect(record.timestamp).toBeDefined();
      expect(record.stability_score).toBe(95);

      const history = await manager.get_audit_history();
      expect(history.length).toBe(1);
      expect(history[0].audit_id).toBe(record.audit_id);
    });

    it('should fetch audit by ID', async () => {
      const record = await manager.save_audit({
        stability_score: 80,
        schema_coverage: 90,
        total_anomalies: 2,
        resolved_anomalies: 1,
        report_markdown: '# Report 2'
      });

      const fetched = await manager.get_audit_by_id(record.audit_id);
      expect(fetched).toBeDefined();
      expect(fetched?.stability_score).toBe(80);
      expect(fetched?.report_markdown).toBe('# Report 2');
    });

    it('should clear audit history logs', async () => {
      await manager.save_audit({
        stability_score: 100,
        schema_coverage: 100,
        total_anomalies: 0,
        resolved_anomalies: 0,
        report_markdown: '# All Good'
      });

      let history = await manager.get_audit_history();
      expect(history.length).toBe(1);

      await manager.clear_history();

      history = await manager.get_audit_history();
      expect(history.length).toBe(0);
    });

    it('should extract composer instructions and save to file', async () => {
      const report_markdown = `
# Report Header
Some intro text.
---
## 📋 Project Specifications
Some specifications table here.
---
## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions
To apply these fixes instantly:
- Open file.
- Apply step 1.
- Apply step 2.

---
## 📋 Recommended Action Plan & Next Steps
- Action 1
- Action 2
      `;

      const result = await manager.export_composer_instructions(report_markdown);
      expect(result.success).toBe(true);
      expect(result.filepath).toContain('.bugbouncer/composer_instructions.md');

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      expect(fs.existsSync(result.filepath)).toBe(true);
      const content = fs.readFileSync(result.filepath, 'utf-8');
      
      expect(content).toContain('## 🤖 Cursor / Bolt AI Composer Quick-Fix Instructions');
      expect(content).toContain('To apply these fixes instantly:');
      expect(content).not.toContain('# Report Header');
      expect(content).not.toContain('## 📋 Recommended Action Plan');
      
      if (fs.existsSync(result.filepath)) {
        fs.unlinkSync(result.filepath);
      }
    });

    it('should fall back to entire report if composer marker is not found', async () => {
      const report_markdown = `# Basic Report Without Composer Section`;
      const result = await manager.export_composer_instructions(report_markdown);
      expect(result.success).toBe(true);
      
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const content = fs.readFileSync(result.filepath, 'utf-8');
      expect(content).toBe('# Basic Report Without Composer Section');
      
      if (fs.existsSync(result.filepath)) {
        fs.unlinkSync(result.filepath);
      }
    });
  });
});

