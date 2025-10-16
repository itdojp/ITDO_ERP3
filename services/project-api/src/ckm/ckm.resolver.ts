import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CkmService } from './ckm.service';
import { CkmStatusModel, CkmWorkspaceModel, CkmWorkspaceSummaryModel } from './models/ckm.models';
import { PostMessageInput, CkmMessageModel, UpdateMessageInput } from './dto/message.dto';

@Resolver()
export class CkmResolver {
  constructor(private readonly ckmService: CkmService) {}

  @Query(() => CkmStatusModel, { description: 'CKM データストアの接続状態を返します。' })
  ckmStatus(): CkmStatusModel {
    return { enabled: this.ckmService.isEnabled() };
  }

  @Query(() => [CkmWorkspaceSummaryModel], {
    description: 'CKM ワークスペース一覧（アクティブのみ）を返します。',
  })
  ckmWorkspaces(): Promise<CkmWorkspaceSummaryModel[]> {
    return this.ckmService.listWorkspaces();
  }

  @Query(() => CkmWorkspaceModel, {
    description: '指定したコードの CKM ワークスペース詳細を返します。',
  })
  ckmWorkspace(@Args('code') code: string): Promise<CkmWorkspaceModel> {
    return this.ckmService.getWorkspaceByCode(code);
  }

  @Mutation(() => CkmMessageModel, { description: 'CKM メッセージを投稿します。' })
  postCkmMessage(@Args('input') input: PostMessageInput, @Args('authorId') authorId: string): Promise<CkmMessageModel> {
    return this.ckmService.createMessage({
      workspaceCode: input.workspaceCode,
      roomId: input.roomId,
      authorId,
      threadId: input.threadId ?? undefined,
      parentMessageId: input.parentMessageId ?? undefined,
      messageType: input.messageType,
      body: input.body,
      priority: input.priority,
      mentions: input.mentions ?? undefined,
      metadataJson: input.metadataJson,
    });
  }

  @Mutation(() => CkmMessageModel, { description: 'CKM メッセージを編集します。' })
  updateCkmMessage(
    @Args('input') input: UpdateMessageInput,
    @Args('editorId') editorId: string,
  ): Promise<CkmMessageModel> {
    return this.ckmService.updateMessage({
      workspaceCode: input.workspaceCode,
      messageId: input.messageId,
      editorId,
      version: input.version,
      body: input.body,
      messageType: input.messageType,
      priority: input.priority,
      mentions: input.mentions ?? undefined,
      metadataJson: input.metadataJson,
    });
  }

  @Mutation(() => Boolean, { description: 'CKM メッセージをソフト削除します。' })
  async deleteCkmMessage(
    @Args('workspaceCode') workspaceCode: string,
    @Args('messageId') messageId: string,
    @Args('actorId') actorId: string,
  ): Promise<boolean> {
    await this.ckmService.deleteMessage({ workspaceCode, messageId, actorId });
    return true;
  }

  @Query(() => [CkmMessageModel], { description: 'キーワードで CKM メッセージを検索します（暫定テキストマッチ）。' })
  ckmMessageSearch(
    @Args('workspaceCode') workspaceCode: string,
    @Args('keyword') keyword: string,
    @Args('roomId', { nullable: true }) roomId?: string,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<CkmMessageModel[]> {
    return this.ckmService.searchMessages({ workspaceCode, keyword, roomId, limit });
  }
}
