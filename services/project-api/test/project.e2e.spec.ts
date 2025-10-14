import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Project API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const projectRoot = join(__dirname, '..');
  const testDbPath = join(projectRoot, 'prisma', 'test.db');

  beforeAll(async () => {
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.CHAT_SUMMARIZER_PROVIDER = 'mock';

    execSync('npx prisma migrate reset --force --skip-generate', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { force: true });
    }
  });

  it('GET /api/v1/projects returns seeded projects', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/projects').expect(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/v1/projects/:id/timeline returns metrics and chat summary', async () => {
    const project = await prisma.project.findFirst({ where: { code: 'ALPHA-01' } });
    expect(project).toBeDefined();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project?.id}/timeline`)
      .expect(200);

    expect(response.body.metrics).toBeDefined();
    expect(response.body.tasks.length).toBeGreaterThan(0);
    expect(response.body.chatSummary).toBeDefined();
  });

  it('supports GraphQL queries for projects', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            projects {
              id
              name
              status
              evm { cpi }
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.data.projects.length).toBeGreaterThan(0);
    expect(response.body.errors).toBeUndefined();
  });
});
