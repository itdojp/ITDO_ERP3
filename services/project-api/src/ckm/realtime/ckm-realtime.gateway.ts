import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnModuleDestroy,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Subscription } from 'rxjs';
import { CkmRealtimeEvent, CkmRealtimeService } from './ckm-realtime.service';

interface GatewaySocket {
  id: string;
  emit: (event: string, payload: CkmRealtimeEvent) => unknown;
  handshake: {
    query?: Record<string, unknown>;
  };
}

interface ClientFilter {
  socket: GatewaySocket;
  workspaceId?: string;
  roomId?: string;
}

/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
@WebSocketGateway({ namespace: 'ckm', transports: ['websocket'], cors: true })
export class CkmRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
  @WebSocketServer()
  server!: Server;

  private readonly clients = new Map<string, ClientFilter>();
  private readonly subscription: Subscription;

  constructor(private readonly realtimeService: CkmRealtimeService) {
    this.subscription = this.realtimeService.onEvent((event) => this.broadcast(event));
  }

  handleConnection(client: GatewaySocket) {
    const socket = this.normalizeSocket(client);
    const workspaceId = this.extractQueryParam(socket, 'workspaceId');
    const roomId = this.extractQueryParam(socket, 'roomId');
    this.clients.set(socket.id, { socket, workspaceId, roomId });
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
}
