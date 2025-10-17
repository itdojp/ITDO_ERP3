import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { CkmMessageType } from '../../../generated/ckm-client';

@InputType()
export class UpdateMessageInput {
  @Field(() => ID)
  workspaceCode!: string;

  @Field(() => ID)
  messageId!: string;

  @Field(() => Int)
  version!: number;

  @Field({ nullable: true })
  body?: string;

  @Field(() => CkmMessageType, { nullable: true })
  messageType?: CkmMessageType;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => [String], { nullable: true })
  mentions?: string[];

  @Field({ nullable: true })
  metadataJson?: string;
}

@InputType()
export class PostMessageInput {
  @Field(() => ID)
  workspaceCode!: string;

  @Field(() => ID)
  roomId!: string;

  @Field(() => ID, { nullable: true })
  threadId?: string;

  @Field(() => ID, { nullable: true })
  parentMessageId?: string;

  @Field(() => CkmMessageType, { defaultValue: CkmMessageType.TEXT })
  messageType?: CkmMessageType;

  @Field()
  body!: string;

  @Field(() => Int, { defaultValue: 0 })
  priority?: number;

  @Field(() => [String], { nullable: true })
  mentions?: string[];

  @Field({ nullable: true })
  metadataJson?: string;
}

@ObjectType()
export class CkmMessageModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  roomId!: string;

  @Field(() => ID, { nullable: true })
  threadId?: string | null;

  @Field(() => ID, { nullable: true })
  parentMessageId?: string | null;

  @Field()
  authorId!: string;

  @Field(() => CkmMessageType)
  messageType!: CkmMessageType;

  @Field(() => Int)
  priority!: number;

  @Field()
  body!: string;

  @Field({ nullable: true })
  bodyRich?: string | null;

  @Field(() => [String], { nullable: true })
  mentions?: string[] | null;

  @Field({ nullable: true })
  metadataJson?: string | null;

  @Field()
  postedAt!: string;

  @Field({ nullable: true })
  deletedAt?: string | null;
}
