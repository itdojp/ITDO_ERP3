import { Module } from '@nestjs/common';
import { CkmService } from './ckm.service';
import { CkmController } from './ckm.controller';
import { CkmResolver } from './ckm.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { CkmNotificationService } from './notification/ckm-notification.service';
import { CkmRealtimeService } from './realtime/ckm-realtime.service';
import { CkmRealtimeGateway } from './realtime/ckm-realtime.gateway';
import { CkmRealtimeController } from './realtime/ckm-realtime.controller';

@Module({
  imports: [PrismaModule],
  providers: [CkmService, CkmResolver, CkmNotificationService, CkmRealtimeService, CkmRealtimeGateway],
  controllers: [CkmController, CkmRealtimeController],
  exports: [CkmService, CkmNotificationService, CkmRealtimeService],
})
export class CkmModule {}
