import { Module } from '@nestjs/common';
import { SalesService } from './service';
import { SalesResolver } from './resolver';

@Module({
  providers: [SalesService, SalesResolver],
})
export class SalesModule {}
