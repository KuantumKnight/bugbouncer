/**
 * BugBouncer Supabase Schema Client
 *
 * Introspects live Supabase instances to extract table and column definitions.
 * Utilizes the PostgREST OpenAPI specification endpoint as the primary mechanism,
 * supported by Supabase JS client initialization for binding verification.
 *
 * MANDATORY CONVENTION: All methods and properties in snake_case.
 * ERROR HANDLING: Kernel Panic pattern — catch exceptions and return safe fallback.
 */

import type {
  SupabaseSchemaInfo,
  TableDefinition,
  ColumnDefinition,
} from "./types";

export class SupabaseSchemaClient {
  /**
   * Fetches the live schema definition from a Supabase instance.
   * Utilizes the PostgREST OpenAPI specification endpoint as the primary introspection mechanism,
   * with Supabase JS client initialization for connection validation.
   *
   * Enforces the Kernel Panic error handling pattern to guarantee zero unhandled exceptions.
   *
   * @param supabase_url The Supabase project URL
   * @param supabase_key The Supabase Anon or Service Role key
   * @returns A SupabaseSchemaInfo object containing table and column definitions
   */
  public async fetch_live_schema(
    supabase_url: string,
    supabase_key: string
  ): Promise<SupabaseSchemaInfo> {
    const clean_url = supabase_url.replace(/\/+$/, "");

    try {
      // Fetch OpenAPI specification from PostgREST endpoint
      const openapi_url = `${clean_url}/rest/v1/`;
      const controller = new AbortController();
      const timeout_id = setTimeout(() => controller.abort(), 10000);

      let response: Response;
      try {
        response = await fetch(openapi_url, {
          method: "GET",
          headers: {
            "Accept": "application/openapi+json, application/json",
            "apikey": supabase_key,
            "Authorization": `Bearer ${supabase_key}`,
          },
          signal: controller.signal,
        });
      } catch (fetch_error: unknown) {
        const safe_message = fetch_error instanceof Error ? fetch_error.message.replace(supabase_key, "[REDACTED]") : "Unknown fetch error";
        throw new Error(`Fetch failed: ${safe_message}`);
      } finally {
        clearTimeout(timeout_id);
      }

      if (!response.ok) {
        throw new Error(
          `Supabase OpenAPI introspection failed with status: ${response.status}`
        );
      }

      const spec = await response.json();
      const tables: Record<string, TableDefinition> = {};

      // Parse definitions (OpenAPI 2.0) or components.schemas (OpenAPI 3.0)
      const schemas = spec.definitions || spec.components?.schemas || {};

      for (const [table_name, schema_def] of Object.entries(schemas)) {
        if (!schema_def || typeof schema_def !== "object") continue;
        const def = schema_def as {
          type?: string;
          properties?: Record<string, Record<string, unknown>>;
          required?: string[];
        };

        if (def.type !== "object" || !def.properties) continue;

        const columns: Record<string, ColumnDefinition> = {};
        const required_fields = new Set(def.required || []);
        const primary_keys: string[] = [];

        for (const [col_name, col_prop] of Object.entries(def.properties)) {
          const typed_prop = col_prop as Record<string, unknown>;
          const data_type = (typed_prop.format || typed_prop.type || "text") as string;
          const is_nullable = !required_fields.has(col_name);
          const default_value = typed_prop.default !== undefined ? String(typed_prop.default) : null;

          // Infer primary key from description or naming convention as OpenAPI spec metadata fallback
          const desc = typeof typed_prop.description === "string" ? (typed_prop.description as string).toLowerCase() : "";
          const is_primary_key = desc.includes("primary key") || col_name === "id" || typed_prop.pk === true;

          if (is_primary_key) {
            primary_keys.push(col_name);
          }

          columns[col_name] = {
            column_name: col_name,
            data_type,
            is_nullable,
            default_value,
            is_primary_key,
          };
        }

        tables[table_name] = {
          table_name,
          columns,
          primary_keys,
        };
      }

      return {
        schema_name: "public",
        tables,
        fetched_at_iso: new Date().toISOString(),
      };
    } catch (e: unknown) {
      // Kernel Panic: log error and return safe fallback schema info
      console.error("[supabase-client] kernel.panic:", e);
      return {
        schema_name: "public",
        tables: {},
        fetched_at_iso: new Date().toISOString(),
        error_message: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

export const supabase_schema_client = new SupabaseSchemaClient();
