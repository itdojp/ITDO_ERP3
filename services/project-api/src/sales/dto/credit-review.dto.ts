/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

@ObjectType()
export class CreditReviewModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Float, { nullable: true })
  score?: number;

  @Field({ nullable: true })
  remarks?: string;

  @Field(() => GraphQLISODateTime)
  requestedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  decidedAt?: Date;
}

@InputType()
export class ApproveCreditReviewInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => Float)
  score!: number;

  @Field({ nullable: true })
  remarks?: string;
}
