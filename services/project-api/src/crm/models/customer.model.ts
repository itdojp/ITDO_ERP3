/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

@ObjectType()
export class ConversationSummaryModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  summaryText!: string;

  @Field(() => [String])
  followupSuggested!: string[];

  @Field(() => Float)
  confidence!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class InteractionNoteModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  channel!: string;

  @Field(() => String)
  rawText!: string;

  @Field(() => GraphQLISODateTime)
  occurredAt!: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => ConversationSummaryModel, { nullable: true })
  summary?: ConversationSummaryModel;
}

@ObjectType()
export class ContactModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  role?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class OpportunityModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  stage!: string;

  @Field(() => Float)
  amount!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => Int, { nullable: true })
  probability?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expectedClose?: Date;

  @Field(() => [InteractionNoteModel])
  notes!: InteractionNoteModel[];
}

@ObjectType()
export class CustomerModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String, { nullable: true })
  industry?: string;

  @Field(() => String, { nullable: true })
  ownerUserId?: string;

  @Field(() => [String])
  tags!: string[];

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => [ContactModel])
  contacts!: ContactModel[];

  @Field(() => [OpportunityModel])
  opportunities!: OpportunityModel[];
}
