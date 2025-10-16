import { BadRequestException, Controller, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CkmRealtimeEvent, CkmRealtimeService } from './ckm-realtime.service';
import { CkmAuthGuard, CkmActor } from '../auth/ckm-auth.guard';
import { CkmService } from '../ckm.service';

@Controller('ckm/realtime')
@UseGuards(CkmAuthGuard)
export class CkmRealtimeController {
  constructor(
    private readonly realtimeService: CkmRealtimeService,
    private readonly ckmService: CkmService,
  ) {}

  @Sse('stream')
  async stream(
    @Req() request: Request & { user?: CkmActor },
    @Query('workspaceId') workspaceId?: string,
    @Query('roomId') roomId?: string,
  ): Promise<Observable<{ data: CkmRealtimeEvent; event: string }>> {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required.');
    }
    const actorId = this.getActorId(request);
    await this.ckmService.verifyRealtimeAccess({ workspaceId, roomId, actorId });

    return this.realtimeService.observe({ workspaceId, roomId }).pipe(
      map((event) => ({ event: event.event, data: event })),
    );
  }

  private getActorId(request: Request & { user?: CkmActor }): string {
    const actorId = request?.user?.id;
    if (!actorId) {
      throw new BadRequestException('Unauthenticated access to CKM realtime stream.');
    }
    return actorId;
  }
}
