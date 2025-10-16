import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CkmService } from './ckm.service';
import { PostMessageInput, UpdateMessageInput } from './dto/message.dto';

@Controller('ckm')
export class CkmController {
  constructor(private readonly ckmService: CkmService) {}

  @Get('status')
  getStatus() {
    return { enabled: this.ckmService.isEnabled() };
  }

  @Get('workspaces')
  listWorkspaces() {
    return this.ckmService.listWorkspaces();
  }

  @Get('workspaces/:code')
  getWorkspace(@Param('code') code: string) {
    return this.ckmService.getWorkspaceByCode(code);
  }

  @Get('workspaces/:code/rooms')
  async listRooms(@Param('code') code: string) {
    const workspace = await this.ckmService.getWorkspaceByCode(code);
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
  postMessage(@Body() body: PostMessageInput & { authorId: string }) {
    return this.ckmService.createMessage({
      workspaceCode: body.workspaceCode,
      roomId: body.roomId,
      authorId: body.authorId,
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
  updateMessage(@Param('id') id: string, @Body() body: UpdateMessageInput & { editorId: string }) {
    return this.ckmService.updateMessage({
      workspaceCode: body.workspaceCode,
      messageId: id,
      editorId: body.editorId,
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
  ) {
    return this.ckmService.searchMessages({
      workspaceCode,
      keyword,
      roomId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete('messages/:id')
  async deleteMessage(
    @Param('id') id: string,
    @Query('workspaceCode') workspaceCode: string,
    @Query('actorId') actorId: string,
  ) {
    await this.ckmService.deleteMessage({ workspaceCode, messageId: id, actorId });
    return { success: true };
  }
}
