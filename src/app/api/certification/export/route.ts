import { NextResponse } from "next/server";
import { AuditHistoryManager } from "@/kernel/generator/certification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { audit_id } = body;
    let { report_markdown } = body;

    const manager = new AuditHistoryManager();

    if (!report_markdown && audit_id) {
      const record = await manager.get_audit_by_id(audit_id);
      if (record) {
        report_markdown = record.report_markdown;
      }
    }

    if (!report_markdown) {
      return NextResponse.json(
        { error: "report_markdown or a valid audit_id is required" },
        { status: 400 }
      );
    }

    const result = await manager.export_composer_instructions(report_markdown);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        filepath: result.filepath
      });
    } else {
      return NextResponse.json(
        { error: "Failed to write instructions to workspace (local filesystem disabled)" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
