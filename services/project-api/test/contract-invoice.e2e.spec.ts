import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Contract Invoice Pipeline (e2e)', () => {
  let app: INestApplication;
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await fs.mkdtemp(path.join(tmpdir(), 'invoice-test-'));
    process.env.INVOICE_OUTPUT_DIR = outputDir;
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.CHAT_SUMMARIZER_PROVIDER = 'mock';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to remove temp output directory', error);
    }
  });

  it('generates invoice artifacts when contract is signed', async () => {
    const payload = {
      type: 'SIGNED',
      occurredAt: new Date().toISOString(),
      triggeredBy: 'automation@test',
      contractId: 'contract-test-1',
      contractCode: 'CONTRACT-TEST-1',
      metadata: { source: 'test' },
      customerEmail: 'billing@example.com',
    };

    await request(app.getHttpServer()).post('/billing/contracts/events').send(payload).expect(201).expect({ status: 'accepted' });

    const files = await fs.readdir(path.join(outputDir, payload.contractCode), { withFileTypes: true }).catch(() => []);
    const pdfExists = files.some((file) => file.isFile() && file.name.endsWith('.pdf'));
    const htmlExists = files.some((file) => file.isFile() && file.name.endsWith('.html'));
    expect(pdfExists).toBe(true);
    expect(htmlExists).toBe(true);
  });
});
