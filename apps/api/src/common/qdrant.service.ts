import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Filter, PointStruct } from './qdrant.dto';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);

  private collectionName: string;
  private client: QdrantClient;

  constructor(private configService: ConfigService) {
    this.client = new QdrantClient({
      host: this.configService.getOrThrow('vectorStore.host'),
      port: this.configService.getOrThrow('vectorStore.port'),
      apiKey: this.configService.get('vectorStore.apiKey') || undefined,
    });
    this.collectionName = 'refly_resource';
  }

  static estimatePointsSize(points: PointStruct[]): number {
    return points.reduce((acc, point) => {
      // Estimate vector size (4 bytes per float)
      const vectorSize = (point.vector as number[]).length * 4;

      // Estimate payload size
      const payloadSize = new TextEncoder().encode(JSON.stringify(point.payload)).length;

      // Estimate ID size (UTF-8 encoding)
      const idSize = new TextEncoder().encode(String(point.id)).length;

      // Add 8 bytes for the point ID (assuming it's a 64-bit integer)
      return acc + vectorSize + payloadSize + idSize;
    }, 0);
  }

  async onModuleInit() {
    await this.ensureCollectionExists();
  }

  async ensureCollectionExists() {
    const { exists } = await this.client.collectionExists(this.collectionName);

    if (!exists) {
      const res = await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.configService.getOrThrow<number>('embeddings.dimensions'),
          distance: 'Cosine',
          on_disk: true,
        },
        hnsw_config: { payload_m: 16, m: 0, on_disk: true },
        on_disk_payload: true,
      });
      this.logger.log(`collection create success: ${res}`);
    } else {
      this.logger.log(`collection already exists: ${this.collectionName}`);
    }

    await Promise.all([
      this.client.createPayloadIndex(this.collectionName, {
        field_name: 'tenantId',
        field_schema: 'keyword',
      }),
    ]);
  }

  async batchSaveData(points: PointStruct[]) {
    return this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });
  }

  async batchDelete(filter: Filter) {
    return this.client.delete(this.collectionName, {
      wait: true,
      filter,
    });
  }

  async search(
    args: {
      query: string;
      vector?: number[];
      limit?: number;
    },
    filter: Filter,
  ) {
    return this.client.search(this.collectionName, {
      vector: args.vector,
      limit: args.limit || 10,
      filter,
    });
  }
}
