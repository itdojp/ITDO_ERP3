import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmController } from './controller';
import { CrmResolver } from './resolver';
import { CrmService } from './service';

@Module({
  imports: [PrismaModule],
  providers: [CrmService, CrmResolver],
  controllers: [CrmController],
})
export class CrmModule {}
