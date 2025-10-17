import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { CkmService } from './ckm.service';
import { CkmStatusModel, CkmWorkspaceModel, CkmWorkspaceSummaryModel } from './models/ckm.models';
import { PostMessageInput, CkmMessageModel, UpdateMessageInput } from './dto/message.dto';
import { CkmAuthGuard, CkmActor } from './auth/ckm-auth.guard';

type GraphQLContext = { req?: { user?: CkmActor } };

@Resolver()
@UseGuards(CkmAuthGuard)
export class CkmResolver {
  constructor(private readonly ckmService: CkmService) {}

  @Query(() => CkmStatusModel, { description: 'CKM データストアの接続状態を返します。' })
  ckmStatus(): CkmStatusModel {
    return { enabled: this.ckmService.isEnabled() };
  }

  @Query(() => [CkmWorkspaceSummaryModel], {
    description: 'CKM ワークスペース一覧（アクティブのみ）を返します。',
  })
  ckmWorkspaces(@Context() context: GraphQLContext): Promise<CkmWorkspaceSummaryModel[]> {
    return this.ckmService.listWorkspaces(this.getActorId(context));
  }

  @Query(() => CkmWorkspaceModel, {
    description: '指定したコードの CKM ワークスペース詳細を返します。',
  })
  ckmWorkspace(@Args('code') code: string, @Context() context: GraphQLContext): Promise<CkmWorkspaceModel> {
    return this.ckmService.getWorkspaceByCode(code, this.getActorId(context));
  }

  @Mutation(() => CkmMessageModel, { description: 'CKM メッセージを投稿します。' })
  postCkmMessage(@Args('input') input: PostMessageInput, @Context() context: GraphQLContext): Promise<CkmMessageModel> {
    return this.ckmService.createMessage({
      workspaceCode: input.workspaceCode,
      roomId: input.roomId,
      authorId: this.getActorId(context),
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
    @Context() context: GraphQLContext,
  ): Promise<CkmMessageModel> {
    return this.ckmService.updateMessage({
      workspaceCode: input.workspaceCode,
      messageId: input.messageId,
      editorId: this.getActorId(context),
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
    @Context() context: GraphQLContext,
  ): Promise<boolean> {
    await this.ckmService.deleteMessage({ workspaceCode, messageId, actorId: this.getActorId(context) });
    return true;
  }

  @Query(() => [CkmMessageModel], { description: 'キーワードで CKM メッセージを検索します（暫定テキストマッチ）。' })
  ckmMessageSearch(
    @Args('workspaceCode') workspaceCode: string,
    @Args('keyword') keyword: string,
    @Args('roomId', { nullable: true }) roomId?: string,
    @Args('limit', { nullable: true }) limit?: number,
    @Context() context: GraphQLContext,
  ): Promise<CkmMessageModel[]> {
    return this.ckmService.searchMessages({
      workspaceCode,
      keyword,
      roomId,
      limit,
      actorId: this.getActorId(context),
    });
  }

  private getActorId(context: GraphQLContext): string {
    const actorId = context?.req?.user?.id;
    if (!actorId) {
      throw new UnauthorizedException('CKM actor context is missing.');
    }
    return actorId;
  }
}
