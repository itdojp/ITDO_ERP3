import { Injectable, Logger } from '@nestjs/common';
import { CkmMessage } from '../ckm.service';
import { CkmRealtimeService, CkmRealtimeEvent } from '../realtime/ckm-realtime.service';

export interface CkmNotificationPayload {
  workspaceId: string;
  roomId: string;
  message: CkmMessage;
}

@Injectable()
export class CkmNotificationService {
  private readonly logger = new Logger(CkmNotificationService.name);

  constructor(private readonly realtimeService: CkmRealtimeService) {}

  async notifyMessageCreated(payload: CkmNotificationPayload) {
    await this.emit('ckm.message.created', payload);
  }

  async notifyMessageUpdated(payload: CkmNotificationPayload) {
    await this.emit('ckm.message.updated', payload);
  }

  async notifyMessageDeleted(payload: CkmNotificationPayload) {
    await this.emit('ckm.message.deleted', payload);
  }

  private async emit(event: CkmRealtimeEvent['event'], payload: CkmNotificationPayload) {
    const data: CkmRealtimeEvent = {
      event,
      workspaceId: payload.workspaceId,
      roomId: payload.roomId,
      message: payload.message,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug({
      event: data.event,
      workspaceId: data.workspaceId,
      roomId: data.roomId,
      messageId: data.message.id,
    });

    await this.realtimeService.publish(data);
  }
}
