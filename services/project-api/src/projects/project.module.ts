import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { ProjectController } from './project.controller';
import { ChatSummaryService } from './chat-summary.service';

@Module({
  imports: [PrismaModule],
  providers: [ProjectService, ProjectResolver, ChatSummaryService],
  controllers: [ProjectController],
})
export class ProjectModule {}
