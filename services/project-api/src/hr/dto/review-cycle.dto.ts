/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

@ObjectType()
export class ReviewCycleModel {
  @Field(() => ID)
  id!: string;

  @Field()
  cycleName!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => [String])
  participantIds!: string[];
}

@InputType()
export class CreateReviewCycleInput {
  @Field()
  cycleName!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => [ID])
  participantIds!: string[];
}
