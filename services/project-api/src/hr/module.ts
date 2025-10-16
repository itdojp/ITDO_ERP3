import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HrService } from './service';
import { HrResolver } from './resolver';

@Module({
  imports: [PrismaModule],
  providers: [HrService, HrResolver],
  exports: [HrService],
})
export class HrModule {}
