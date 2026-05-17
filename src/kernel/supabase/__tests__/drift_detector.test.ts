import { describe, it, expect } from "vitest";
import { supabase_drift_detector } from "../drift_detector";
import type { SupabaseSchemaInfo } from "../types";

const MOCK_SUPABASE_CLI_TYPES = `
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string | null;
          is_active: boolean;
        };
        Insert: { id?: string; };
        Update: { is_active?: boolean; };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          user_id: string;
        };
      };
    };
  };
}
`;

const MOCK_EXPORTED_INTERFACES = `
export interface Users {
  id: string;
  created_at?: string;
  is_active: boolean;
}

export interface Posts {
  id: string;
  title: string;
  user_id: string;
}
`;

describe("SupabaseDriftDetector", () => {
  describe("parse_local_schema", () => {
    it("should parse Supabase CLI generated Database interface (Strategy 1)", () => {
      const schema = supabase_drift_detector.parse_local_schema(
        "types/supabase.ts",
        MOCK_SUPABASE_CLI_TYPES
      );

      expect(schema.schema_name).toBe("local_ts");
      expect(schema.tables.users).toBeDefined();
      expect(schema.tables.posts).toBeDefined();

      const users_table = schema.tables.users;
      expect(users_table.table_name).toBe("users");
      expect(users_table.columns.id.data_type).toBe("text");
      expect(users_table.columns.id.is_nullable).toBe(false);
      expect(users_table.columns.id.is_primary_key).toBe(true);

      expect(users_table.columns.created_at.data_type).toBe("text");
      expect(users_table.columns.created_at.is_nullable).toBe(true);

      expect(users_table.columns.is_active.data_type).toBe("boolean");
      expect(users_table.columns.is_active.is_nullable).toBe(false);
    });

    it("should parse standard exported interfaces as fallback (Strategy 2)", () => {
      const schema = supabase_drift_detector.parse_local_schema(
        "models.ts",
        MOCK_EXPORTED_INTERFACES
      );

      expect(schema.schema_name).toBe("local_ts");
      expect(schema.tables.users).toBeDefined();
      expect(schema.tables.posts).toBeDefined();

      const users_table = schema.tables.users;
      expect(users_table.table_name).toBe("users");
      expect(users_table.columns.id.data_type).toBe("text");
      expect(users_table.columns.id.is_nullable).toBe(false);
      expect(users_table.columns.created_at.is_nullable).toBe(true);
    });

    it("should enforce Kernel Panic pattern on invalid input or missing file", () => {
      // Passing no content and a non-existent path in non-Node or without mocking fs
      const schema = supabase_drift_detector.parse_local_schema(
        "non_existent_file_path_12345.ts"
      );
      expect(schema.schema_name).toBe("local_ts");
      expect(schema.tables).toEqual({});
    });
  });

  describe("detect_supabase_drift", () => {
    const base_local_schema: SupabaseSchemaInfo = {
      schema_name: "local_ts",
      fetched_at_iso: "2026-05-17T00:00:00Z",
      tables: {
        users: {
          table_name: "users",
          primary_keys: ["id"],
          columns: {
            id: { column_name: "id", data_type: "text", is_nullable: false, default_value: null, is_primary_key: true },
            name: { column_name: "name", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false },
            age: { column_name: "age", data_type: "integer", is_nullable: false, default_value: null, is_primary_key: false },
          },
        },
      },
    };

    it("should report zero drift when schemas match perfectly", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {
          users: {
            table_name: "users",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
              name: { column_name: "name", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false },
              age: { column_name: "age", data_type: "bigint", is_nullable: false, default_value: null, is_primary_key: false },
            },
          },
        },
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(false);
      expect(result.mismatches).toEqual([]);
      expect(result.scanned_tables_count).toBe(1);
    });

    it("should detect missing live table", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {},
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(true);
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0].mismatch_type).toBe("missing_table");
      expect(result.mismatches[0].table_name).toBe("users");
    });

    it("should detect missing live column", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {
          users: {
            table_name: "users",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
              name: { column_name: "name", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false },
              // age is missing
            },
          },
        },
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(true);
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0].mismatch_type).toBe("missing_column");
      expect(result.mismatches[0].column_name).toBe("age");
    });

    it("should detect type mismatch", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {
          users: {
            table_name: "users",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
              name: { column_name: "name", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false },
              age: { column_name: "age", data_type: "boolean", is_nullable: false, default_value: null, is_primary_key: false }, // boolean instead of integer
            },
          },
        },
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(true);
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0].mismatch_type).toBe("type_mismatch");
      expect(result.mismatches[0].column_name).toBe("age");
      expect(result.mismatches[0].expected_type).toBe("integer");
      expect(result.mismatches[0].actual_type).toBe("boolean");
    });

    it("should detect nullability mismatch", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {
          users: {
            table_name: "users",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
              name: { column_name: "name", data_type: "text", is_nullable: false, default_value: null, is_primary_key: false }, // false instead of true
              age: { column_name: "age", data_type: "integer", is_nullable: false, default_value: null, is_primary_key: false },
            },
          },
        },
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(true);
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0].mismatch_type).toBe("nullability_mismatch");
      expect(result.mismatches[0].column_name).toBe("name");
      expect(result.mismatches[0].expected_nullable).toBe(true);
      expect(result.mismatches[0].actual_nullable).toBe(false);
    });

    it("should detect missing local table and missing local column (Live -> Local check)", () => {
      const live_schema: SupabaseSchemaInfo = {
        schema_name: "public",
        fetched_at_iso: "2026-05-17T00:00:00Z",
        tables: {
          users: {
            table_name: "users",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
              name: { column_name: "name", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false },
              age: { column_name: "age", data_type: "integer", is_nullable: false, default_value: null, is_primary_key: false },
              email: { column_name: "email", data_type: "text", is_nullable: true, default_value: null, is_primary_key: false }, // missing locally
            },
          },
          orders: {
            table_name: "orders",
            primary_keys: ["id"],
            columns: {
              id: { column_name: "id", data_type: "uuid", is_nullable: false, default_value: null, is_primary_key: true },
            },
          }, // missing locally
        },
      };

      const result = supabase_drift_detector.detect_supabase_drift(base_local_schema, live_schema);
      expect(result.has_drift).toBe(true);
      const missing_table = result.mismatches.find(m => m.mismatch_type === "missing_table" && m.table_name === "orders");
      const missing_col = result.mismatches.find(m => m.mismatch_type === "missing_column" && m.column_name === "email");

      expect(missing_table).toBeDefined();
      expect(missing_col).toBeDefined();
    });

    it("should enforce Kernel Panic pattern on corrupt schema objects", () => {
      // Passing null/undefined as schema to trigger internal exception and verify Kernel Panic safety
      const result = supabase_drift_detector.detect_supabase_drift(
        null as unknown as SupabaseSchemaInfo,
        null as unknown as SupabaseSchemaInfo
      );

      expect(result.has_drift).toBe(false);
      expect(result.mismatches).toEqual([]);
      expect(result.error_message).toBeDefined();
    });
  });
});
