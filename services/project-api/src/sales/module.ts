import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './controller';
import { SalesResolver } from './resolver';
import { SalesService } from './service';

@Module({
  imports: [PrismaModule],
  providers: [SalesService, SalesResolver],
  controllers: [SalesController],
})
export class SalesModule {}
