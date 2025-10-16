import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  CkmRoomType as PrismaCkmRoomType,
  CkmWorkspaceRole as PrismaCkmWorkspaceRole,
} from '../../../generated/ckm-client';

registerEnumType(PrismaCkmRoomType, { name: 'CkmRoomType' });
registerEnumType(PrismaCkmWorkspaceRole, { name: 'CkmWorkspaceRole' });

@ObjectType()
export class CkmStatusModel {
  @Field()
  enabled!: boolean;
}

@ObjectType()
export class CkmWorkspaceSummaryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field(() => PrismaCkmWorkspaceRole)
  defaultRole!: PrismaCkmWorkspaceRole;

  @Field()
  isPrivate!: boolean;

  @Field({ nullable: true })
  archivedAt?: string | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;

  @Field(() => Int)
  roomCount!: number;

  @Field(() => Int)
  memberCount!: number;
}

@ObjectType()
export class CkmChatRoomModel {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  topic?: string | null;

  @Field(() => PrismaCkmRoomType)
  roomType!: PrismaCkmRoomType;

  @Field()
  isPrivate!: boolean;

  @Field({ nullable: true })
  archivedAt?: string | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;

  @Field(() => Int)
  memberCount!: number;
}

@ObjectType()
export class CkmWorkspaceModel extends CkmWorkspaceSummaryModel {
  @Field(() => [CkmChatRoomModel])
  rooms!: CkmChatRoomModel[];
}
