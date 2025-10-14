import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { toSql } from 'pgvector';

export interface VectorStorePayload {
  threadId: string;
  projectId: string;
  embedding: number[];
  summary: string;
}

export interface VectorStore {
  saveEmbedding(payload: VectorStorePayload): Promise<void>;
}

class NullVectorStore implements VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveEmbedding(_payload: VectorStorePayload): Promise<void> {
    // no-op
  }
}

class PostgresVectorStore implements VectorStore {
  private readonly logger = new Logger(PostgresVectorStore.name);

  constructor(private readonly pool: Pool, private readonly dimension: number, private readonly table: string) {}

  static async create(connectionString: string, table = 'chat_thread_embeddings', dimension = 1536) {
    const pool = new Pool({ connectionString });
    const store = new PostgresVectorStore(pool, dimension, table);
    await store.initialize();
    return store;
  }

  async saveEmbedding(payload: VectorStorePayload): Promise<void> {
    try {
      const embedding =
        payload.embedding.length === this.dimension
          ? payload.embedding
          : this.padEmbedding(payload.embedding, this.dimension);
      await this.pool.query(
        `
          INSERT INTO ${this.table} (thread_id, project_id, summary, embedding)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (thread_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            summary = EXCLUDED.summary,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
        `,
        [payload.threadId, payload.projectId, payload.summary, toSql(embedding)],
      );
    } catch (error) {
      this.logger.warn(`Failed to persist embedding for thread ${payload.threadId}`, error as Error);
    }
  }

  private async initialize() {
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(
      `
      CREATE TABLE IF NOT EXISTS ${this.table} (
        thread_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        summary TEXT,
        embedding vector(${this.dimension}) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
    );
  }

  private padEmbedding(values: number[], dimension: number): number[] {
    if (values.length > dimension) {
      return values.slice(0, dimension);
    }
    const remainder = Array.from({ length: dimension - values.length }, () => 0);
    return [...values, ...remainder];
  }
}

@Injectable()
export class VectorStoreService implements VectorStore {
  private readonly storePromise?: Promise<VectorStore>;
  private readonly nullStore = new NullVectorStore();

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('VECTOR_STORE_URL');
    if (!connectionString) {
      this.storePromise = undefined;
      return;
    }
    const table = configService.get<string>('VECTOR_STORE_TABLE') ?? 'chat_thread_embeddings';
    const dimension = Number(configService.get<number>('VECTOR_STORE_DIMENSION') ?? 1536);
    this.storePromise = PostgresVectorStore.create(connectionString, table, dimension);
  }

  async saveEmbedding(payload: VectorStorePayload): Promise<void> {
    if (!this.storePromise) {
      await this.nullStore.saveEmbedding(payload);
      return;
    }
    const store = await this.storePromise;
    await store.saveEmbedding(payload);
  }
}
