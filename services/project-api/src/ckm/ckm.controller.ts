import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { CkmService } from './ckm.service';
import { PostMessageInput, UpdateMessageInput } from './dto/message.dto';
import { CkmAuthGuard, CkmActor } from './auth/ckm-auth.guard';

@Controller('ckm')
@UseGuards(CkmAuthGuard)
export class CkmController {
  constructor(private readonly ckmService: CkmService) {}

  @Get('status')
  getStatus() {
    return { enabled: this.ckmService.isEnabled() };
  }

  @Get('workspaces')
  listWorkspaces(@Req() request: Request & { user?: CkmActor }) {
    return this.ckmService.listWorkspaces(this.getActorId(request));
  }

  @Get('workspaces/:code')
  getWorkspace(@Param('code') code: string, @Req() request: Request & { user?: CkmActor }) {
    return this.ckmService.getWorkspaceByCode(code, this.getActorId(request));
  }

  @Get('workspaces/:code/rooms')
  async listRooms(@Param('code') code: string, @Req() request: Request & { user?: CkmActor }) {
    const workspace = await this.ckmService.getWorkspaceByCode(code, this.getActorId(request));
    return {
      workspace: {
        id: workspace.id,
        code: workspace.code,
        name: workspace.name,
      },
      rooms: workspace.rooms,
    };
  }

  @Post('messages')
  postMessage(@Req() request: Request & { user?: CkmActor }, @Body() body: PostMessageInput) {
    return this.ckmService.createMessage({
      workspaceCode: body.workspaceCode,
      roomId: body.roomId,
      authorId: this.getActorId(request),
      threadId: body.threadId ?? undefined,
      parentMessageId: body.parentMessageId ?? undefined,
      messageType: body.messageType,
      body: body.body,
      priority: body.priority,
      mentions: body.mentions ?? undefined,
      metadataJson: body.metadataJson,
    });
  }

  @Patch('messages/:id')
  updateMessage(
    @Param('id') id: string,
    @Req() request: Request & { user?: CkmActor },
    @Body() body: UpdateMessageInput,
  ) {
    return this.ckmService.updateMessage({
      workspaceCode: body.workspaceCode,
      messageId: id,
      editorId: this.getActorId(request),
      version: body.version,
      body: body.body,
      messageType: body.messageType,
      priority: body.priority,
      mentions: body.mentions ?? undefined,
      metadataJson: body.metadataJson,
    });
  }

  @Get('messages/search')
  searchMessages(
    @Query('workspaceCode') workspaceCode: string,
    @Query('keyword') keyword: string,
    @Query('roomId') roomId?: string,
    @Query('limit') limit?: number,
    @Req() request?: Request & { user?: CkmActor },
  ) {
    return this.ckmService.searchMessages({
      workspaceCode,
      keyword,
      roomId,
      limit: limit ? Number(limit) : undefined,
      actorId: this.getActorId(request),
    });
  }

  @Delete('messages/:id')
  async deleteMessage(
    @Param('id') id: string,
    @Query('workspaceCode') workspaceCode: string,
    @Req() request: Request & { user?: CkmActor },
  ) {
    await this.ckmService.deleteMessage({
      workspaceCode,
      messageId: id,
      actorId: this.getActorId(request),
    });
    return { success: true };
  }

  private getActorId(request?: Request & { user?: CkmActor }): string {
    const actorId = request?.user?.id;
    if (!actorId) {
      throw new UnauthorizedException('CKM actor context is missing.');
    }
    return actorId;
  }
}
