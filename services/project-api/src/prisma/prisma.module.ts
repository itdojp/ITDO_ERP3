import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CkmPrismaService } from './ckm-prisma.service';

@Module({
  providers: [PrismaService, CkmPrismaService],
  exports: [PrismaService, CkmPrismaService],
})
export class PrismaModule {}
