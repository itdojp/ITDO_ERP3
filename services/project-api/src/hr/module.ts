import { Module } from '@nestjs/common';
import { HrService } from './service';
import { HrResolver } from './resolver';

@Module({
  providers: [HrService, HrResolver],
  exports: [HrService],
})
export class HrModule {}
