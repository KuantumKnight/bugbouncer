import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrivateLocalRag } from "../index";
import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { SearchResult } from "@/types/ledger";
import type { Mocked } from "vitest";

vi.mock("@/kernel/bridge/ledger-client");

describe("PrivateLocalRag", () => {
  let mock_client: Mocked<LedgerClient>;
  let rag: PrivateLocalRag;

  beforeEach(() => {
    vi.resetAllMocks();
    mock_client = new LedgerClient() as Mocked<LedgerClient>;
    rag = new PrivateLocalRag(mock_client);
  });

  it("initializes project metadata via the ledger client", async () => {
    mock_client.save_project.mockResolvedValue();

    await rag.initialize_project({
      project_id: "test_proj_123",
      framework: "nextjs",
      auth_provider: "clerk",
      database_provider: "supabase",
    });

    expect(mock_client.save_project).toHaveBeenCalledWith(
      "test_proj_123",
      "nextjs",
      "clerk",
      "supabase"
    );
  });

  it("indexes a schema file correctly", async () => {
    mock_client.index_schema.mockResolvedValue();

    await rag.index_schema_file("test_proj_123", "schema.ts", "type Test = string;");

    expect(mock_client.index_schema).toHaveBeenCalledWith(
      "test_proj_123",
      "schema.ts",
      "type Test = string;"
    );
  });

  it("searches the context and returns results in <500ms budget mock", async () => {
    const mock_results: SearchResult[] = [
      {
        file_path: "schema.ts",
        content: "type Test = string;",
        rank: -1.5,
      },
    ];

    mock_client.search_schema.mockResolvedValue(mock_results);

    const start = performance.now();
    const results = await rag.search_context("test_proj_123", "Test type", 5);
    const duration = performance.now() - start;

    expect(mock_client.search_schema).toHaveBeenCalledWith("test_proj_123", "Test type", 5);
    expect(results).toEqual(mock_results);
    expect(duration).toBeLessThan(500); // Ensures our minimal wrapper is not adding heavy blocking logic
  });
});
