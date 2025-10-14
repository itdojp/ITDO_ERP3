import { Module } from '@nestjs/common';
import { CrmService } from './service';
import { CrmResolver } from './resolver';

@Module({
  providers: [CrmService, CrmResolver],
})
export class CrmModule {}
