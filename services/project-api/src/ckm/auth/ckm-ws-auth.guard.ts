import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CkmActor } from './ckm-auth.guard';

const USER_HEADER = 'x-user-id';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: CkmActor;
  };
}

@Injectable()
export class CkmWsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const actorId = this.extractUserId(client?.handshake?.headers as Record<string, unknown> | undefined);
    if (!actorId) {
      throw new UnauthorizedException('Missing X-User-Id header.');
    }

    if (!client.data) {
      client.data = {};
    }
    client.data.user = { id: actorId };
    return true;
  }

  private extractUserId(headers?: Record<string, unknown>): string | undefined {
    if (!headers) {
      return undefined;
    }
    const value = headers[USER_HEADER] ?? headers[USER_HEADER.toUpperCase()];
    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === 'string');
      return first;
    }
    return typeof value === 'string' ? value : undefined;
  }
}
