import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { SearchResult } from "@/types/ledger";

export interface ProjectMetadata {
  project_id: string;
  framework: string;
  auth_provider: string;
  database_provider: string;
}

export class PrivateLocalRag {
  private client: LedgerClient;

  constructor(client: LedgerClient) {
    this.client = client;
  }

  /**
   * Initializes a new project in the private local RAG pipeline.
   * Automatically saves the project metadata to the SQLite Ledger.
   */
  async initialize_project(metadata: ProjectMetadata): Promise<void> {
    await this.client.save_project(
      metadata.project_id,
      metadata.framework,
      metadata.auth_provider,
      metadata.database_provider
    );
  }

  /**
   * Indexes a schema file (e.g., Supabase TS definitions, Prisma schema)
   * into the local FTS5 search index.
   */
  async index_schema_file(project_id: string, file_path: string, content: string): Promise<void> {
    await this.client.index_schema(project_id, file_path, content);
  }

  /**
   * Searches the indexed schemas using full-text search.
   * Returns snippets of relevant schemas in <500ms.
   */
  async search_context(project_id: string, query: string, limit: number = 5): Promise<SearchResult[]> {
    return await this.client.search_schema(project_id, query, limit);
  }
}
