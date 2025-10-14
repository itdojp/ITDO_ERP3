import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { ProjectController } from './project.controller';
import { ChatSummaryService } from './chat-summary.service';
import { VectorStoreService } from './vector-store.service';
import { DatadogMetricsService } from '../monitoring/datadog.service';
import { VECTOR_STORE_TOKEN } from './vector-store.token';

@Module({
  imports: [PrismaModule],
  providers: [
    ProjectService,
    ProjectResolver,
    ChatSummaryService,
    DatadogMetricsService,
    {
      provide: VECTOR_STORE_TOKEN,
      useClass: VectorStoreService,
    },
  ],
  controllers: [ProjectController],
})
export class ProjectModule {}
