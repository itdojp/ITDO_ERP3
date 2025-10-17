import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient as GeneratedCkmPrismaClient } from '../../generated/ckm-client';

@Injectable()
export class CkmPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CkmPrismaService.name);
  private client?: GeneratedCkmPrismaClient;

  get enabled(): boolean {
    return Boolean(this.client);
  }

  get prisma(): GeneratedCkmPrismaClient {
    if (!this.client) {
      throw new Error('CKM PrismaClient is disabled. Set DATABASE_CKM_URL to enable the CKM datastore.');
    }
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_CKM_URL;
    if (!databaseUrl) {
      this.logger.warn('DATABASE_CKM_URL が未設定のため CKM PrismaClient は初期化されません。');
      return;
    }

    this.client = new GeneratedCkmPrismaClient({
      datasources: {
        ckm: {
          url: databaseUrl,
        },
      },
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });

    try {
      await this.client.$connect();
      this.logger.log('CKM PrismaClient connected.');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`CKM PrismaClient の接続に失敗しました: ${err.message}`, err.stack);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.$disconnect();
  }
}
