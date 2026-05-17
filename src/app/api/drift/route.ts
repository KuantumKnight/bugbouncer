import { NextResponse } from "next/server";
import { supabase_schema_client } from "@/kernel/supabase/client";
import { supabase_drift_detector } from "@/kernel/supabase/drift_detector";
import { causal_context } from "@/kernel/context";
import * as path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supabase_url, supabase_key, schema_file_path } = body;

    if (!supabase_url || !supabase_key) {
      return NextResponse.json(
        { error: "supabase_url and supabase_key are required" },
        { status: 400 }
      );
    }

    // Default to the typical path if not provided
    const local_path = schema_file_path || path.join(process.cwd(), "types", "supabase.ts");

    return await causal_context.run_in_context("drift-check-" + Date.now(), async () => {
      // 1. Parse local schema
      const local_schema = supabase_drift_detector.parse_local_schema(local_path);
      if (local_schema.error_message) {
        return NextResponse.json(
          { error: "Failed to parse local schema", details: local_schema.error_message },
          { status: 500 }
        );
      }

      // 2. Fetch live schema
      const live_schema = await supabase_schema_client.fetch_live_schema(
        supabase_url,
        supabase_key
      );
      if (live_schema.error_message) {
        return NextResponse.json(
          { error: "Failed to fetch live schema", details: live_schema.error_message },
          { status: 500 }
        );
      }

      // 3. Compare schemas
      const drift_result = supabase_drift_detector.detect_supabase_drift(
        local_schema,
        live_schema
      );

      return NextResponse.json(drift_result);
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
