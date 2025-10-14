import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './controller';
import { SalesResolver } from './resolver';
import { SalesService } from './service';
import { SalesMetricsService } from './metrics/sales-metrics.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [SalesService, SalesResolver, SalesMetricsService],
  controllers: [SalesController],
})
export class SalesModule {}
