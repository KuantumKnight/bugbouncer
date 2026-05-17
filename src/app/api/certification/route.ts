import { NextResponse } from "next/server";
import {
  generate_certification_report,
  calculate_stability_score,
  AuditHistoryManager
} from "@/kernel/generator/certification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      project_id,
      framework,
      auth_provider,
      database_provider,
      anomalies = [],
      resolved_anomalies = [],
      schema_coverage = 100,
      seed = "bugbouncer-default-seed"
    } = body;

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const report_options = {
      project_id,
      framework,
      auth_provider,
      database_provider,
      anomalies,
      resolved_anomalies,
      schema_coverage,
      seed
    };

    const report_markdown = generate_certification_report(report_options);
    const score = calculate_stability_score(anomalies, schema_coverage);

    const manager = new AuditHistoryManager();
    const saved_record = await manager.save_audit({
      stability_score: score,
      schema_coverage,
      total_anomalies: anomalies.length,
      resolved_anomalies: resolved_anomalies.length,
      report_markdown
    });

    return NextResponse.json({ report: report_markdown, record: saved_record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const manager = new AuditHistoryManager();
    const history = await manager.get_audit_history();
    return NextResponse.json(history);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const manager = new AuditHistoryManager();
    await manager.clear_history();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
