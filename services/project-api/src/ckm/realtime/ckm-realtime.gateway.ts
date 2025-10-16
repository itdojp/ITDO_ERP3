import { Logger, UnauthorizedException, UseGuards } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Subscription } from 'rxjs';
import { CkmRealtimeEvent, CkmRealtimeService } from './ckm-realtime.service';
import { CkmWsAuthGuard } from '../auth/ckm-ws-auth.guard';
import { CkmService } from '../ckm.service';
import { CkmActor } from '../auth/ckm-auth.guard';

interface GatewaySocket {
  id: string;
  emit: (event: string, payload: CkmRealtimeEvent) => unknown;
  disconnect: (close?: boolean) => unknown;
  data?: {
    user?: CkmActor;
  };
  handshake: {
    query?: Record<string, unknown>;
  };
}

interface ClientFilter {
  socket: GatewaySocket;
  workspaceId?: string;
  roomId?: string;
}

@WebSocketGateway({ namespace: 'ckm', transports: ['websocket'], cors: true })
@UseGuards(CkmWsAuthGuard)
export class CkmRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CkmRealtimeGateway.name);
  private readonly clients = new Map<string, ClientFilter>();
  private readonly subscription: Subscription;

  constructor(
    private readonly realtimeService: CkmRealtimeService,
    private readonly ckmService: CkmService,
  ) {
    this.subscription = this.realtimeService.onEvent((event) => this.broadcast(event));
  }

  async handleConnection(client: GatewaySocket): Promise<void> {
    const socket = this.normalizeSocket(client);
    try {
      const workspaceId = this.extractQueryParam(socket, 'workspaceId');
      if (!workspaceId) {
        throw new UnauthorizedException('workspaceId is required for CKM realtime subscription.');
      }
      const roomId = this.extractQueryParam(socket, 'roomId');
      const actorId = this.getActorId(socket);
      await this.ckmService.verifyRealtimeAccess({ workspaceId, roomId, actorId });
      this.clients.set(socket.id, { socket, workspaceId, roomId });
    } catch (error) {
      this.logger.warn(`CKM websocket connection denied: ${(error as Error).message}`);
      this.clients.delete(socket.id);
      socket.disconnect(true);
    }
  }

  handleDisconnect(client: GatewaySocket) {
    const socket = this.normalizeSocket(client);
    this.clients.delete(socket.id);
  }

  onModuleDestroy() {
    this.subscription.unsubscribe();
    this.clients.clear();
  }

  private broadcast(event: CkmRealtimeEvent) {
    for (const { socket, workspaceId, roomId } of this.clients.values()) {
      if (workspaceId && workspaceId !== event.workspaceId) {
        continue;
      }
      if (roomId && roomId !== event.roomId) {
        continue;
      }
      socket.emit(event.event, event);
    }
  }

  private extractQueryParam(socket: GatewaySocket, key: 'workspaceId' | 'roomId'): string | undefined {
    const rawValue = socket.handshake?.query?.[key];
    if (Array.isArray(rawValue)) {
      const head = rawValue.find((value): value is string => typeof value === 'string');
      return head;
    }
    return typeof rawValue === 'string' ? rawValue : undefined;
  }

  private normalizeSocket(client: GatewaySocket): GatewaySocket {
    const handshakeQuery = client.handshake?.query ?? {};
    return {
      ...client,
      handshake: {
        ...client.handshake,
        query: handshakeQuery,
      },
    };
  }

  private getActorId(socket: GatewaySocket): string {
    const actorId = socket.data?.user?.id;
    if (!actorId) {
      throw new UnauthorizedException('CKM actor context is missing.');
    }
    return actorId;
  }
}
