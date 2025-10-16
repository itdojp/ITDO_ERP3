import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { Subject, Observable, Subscription } from 'rxjs';
import { filter as rxFilter } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { CkmMessage } from '../ckm.service';

export interface CkmRealtimeEvent {
  event: 'ckm.message.created' | 'ckm.message.updated' | 'ckm.message.deleted';
  workspaceId: string;
  roomId: string;
  message: CkmMessage;
  timestamp: string;
}

type InternalRealtimeEvent = CkmRealtimeEvent & { sourceId?: string };

@Injectable()
export class CkmRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CkmRealtimeService.name);
  private readonly streamKey = 'ckm:events';
  private readonly instanceId = randomUUID();
  private readonly subject = new Subject<CkmRealtimeEvent>();
  private redis: RedisClientType | null = null;
  private redisEnabled = false;
  private stopConsumer = false;
  private consumerRunning = false;

  get events$(): Observable<CkmRealtimeEvent> {
    return this.subject.asObservable();
  }

  isRedisEnabled(): boolean {
    return this.redisEnabled;
  }

  async onModuleInit() {
    const url = process.env.CKM_REDIS_URL ?? process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('CKM_REDIS_URL が未設定のため、リアルタイム配信は単一ノード内のみで動作します。');
      return;
    }
    this.redis = createClient({ url });
    this.redis.on('error', (err: Error) => this.logger.error('Redis error', err));
    await this.redis.connect();
    await this.redis
      .xGroupCreate(this.streamKey, 'ckm-consumers', '$', { MKSTREAM: true })
      .catch((err: Error) => {
        if (!String(err).includes('BUSYGROUP')) {
          throw err;
        }
      });
    this.redisEnabled = true;
    void this.startRedisConsumer();
    this.logger.log('CKM Redis 接続完了');
  }

  async onModuleDestroy() {
    this.stopConsumer = true;
    if (this.redis) {
      await this.redis.disconnect();
    }
    this.subject.complete();
  }

  async publish(event: CkmRealtimeEvent) {
    this.subject.next(event);
    if (this.redis && this.redisEnabled) {
      const payload: InternalRealtimeEvent = { ...event, sourceId: this.instanceId };
      await this.redis.xAdd(this.streamKey, '*', { payload: JSON.stringify(payload) });
    }
  }

  observe(filter?: { workspaceId?: string; roomId?: string }): Observable<CkmRealtimeEvent> {
    return this.events$.pipe(
      rxFilter((event) => {
        if (filter?.workspaceId && event.workspaceId !== filter.workspaceId) {
          return false;
        }
        if (filter?.roomId && event.roomId !== filter.roomId) {
          return false;
        }
        return true;
      }),
    );
  }

  onEvent(handler: (event: CkmRealtimeEvent) => void): Subscription {
    return this.events$.subscribe(handler);
  }

  private async startRedisConsumer() {
    if (!this.redis || this.consumerRunning) {
      return;
    }
    this.consumerRunning = true;
    let cursor = '$';

    while (!this.stopConsumer && this.redis) {
      try {
        const streams = await this.redis.xRead({ key: this.streamKey, id: cursor }, { BLOCK: 1000, COUNT: 50 });
        if (!streams || streams.length === 0) {
          continue;
        }

        const [stream] = streams;
        for (const message of stream.messages) {
          cursor = message.id;
          const payloadStr = message.message.payload as string | undefined;
          if (!payloadStr) {
            continue;
          }
          try {
            const payload = JSON.parse(payloadStr) as InternalRealtimeEvent;
            if (payload.sourceId === this.instanceId) {
              continue;
            }
            const { sourceId: _sourceId, ...event } = payload;
            void _sourceId;
            this.subject.next(event as CkmRealtimeEvent);
          } catch (err) {
            this.logger.error('Failed to parse CKM realtime event', err);
          }
        }
      } catch (err) {
        this.logger.error('CKM Redis consumer error', err);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.consumerRunning = false;
  }
}
