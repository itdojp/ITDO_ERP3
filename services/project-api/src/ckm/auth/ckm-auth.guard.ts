import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface CkmActor {
  id: string;
}

const USER_HEADER = 'x-user-id';

@Injectable()
export class CkmAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    switch (context.getType<'http' | 'graphql'>()) {
      case 'graphql':
        return this.handleGraphql(context);
      case 'http':
      default:
        return this.handleHttp(context);
    }
  }

  private handleHttp(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, unknown> & { headers?: Record<string, unknown>; user?: CkmActor }>();
    const actorId = this.extractUserId(request?.headers);
    if (!actorId) {
      throw new UnauthorizedException('Missing X-User-Id header.');
    }
    request.user = { id: actorId };
    return true;
  }

  private handleGraphql(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context).getContext<{ req?: Record<string, unknown> & { headers?: Record<string, unknown>; user?: CkmActor } }>();
    const request = gqlContext?.req ?? gqlContext;
    const actorId = this.extractUserId(request?.headers as Record<string, unknown> | undefined);
    if (!actorId) {
      throw new UnauthorizedException('Missing X-User-Id header.');
    }
    if (request) {
      (request as Record<string, unknown> & { user?: CkmActor }).user = { id: actorId };
    }
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
