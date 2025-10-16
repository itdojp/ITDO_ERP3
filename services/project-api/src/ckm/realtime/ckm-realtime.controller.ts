import { Controller, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CkmRealtimeEvent, CkmRealtimeService } from './ckm-realtime.service';

@Controller('ckm/realtime')
export class CkmRealtimeController {
  constructor(private readonly realtimeService: CkmRealtimeService) {}

  @Sse('stream')
  stream(
    @Query('workspaceId') workspaceId?: string,
    @Query('roomId') roomId?: string,
  ): Observable<{ data: CkmRealtimeEvent; event: string }> {
    return this.realtimeService.observe({ workspaceId, roomId }).pipe(
      map((event) => ({ event: event.event, data: event })),
    );
  }
}
