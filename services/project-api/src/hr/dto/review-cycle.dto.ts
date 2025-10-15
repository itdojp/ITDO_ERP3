/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLDateTime } from 'graphql-scalars';

@ObjectType()
export class ReviewCycleModel {
  @Field(() => ID)
  id!: string;

  @Field()
  cycleName!: string;

  @Field(() => GraphQLDateTime)
  startDate!: Date;

  @Field(() => GraphQLDateTime)
  endDate!: Date;

  @Field(() => [String])
  participantIds!: string[];
}

@InputType()
export class CreateReviewCycleInput {
  @Field()
  cycleName!: string;

  @Field(() => GraphQLDateTime)
  startDate!: Date;

  @Field(() => GraphQLDateTime)
  endDate!: Date;

  @Field(() => [ID])
  participantIds!: string[];
}

export enum ReviewReminderPhase {
  KICKOFF = 'KICKOFF',
  MIDPOINT = 'MIDPOINT',
  FINAL = 'FINAL',
}

registerEnumType(ReviewReminderPhase, {
  name: 'ReviewReminderPhase',
});

@ObjectType()
export class ReviewReminderModel {
  @Field(() => ID)
  cycleId!: string;

  @Field(() => ID)
  participantId!: string;

  @Field(() => GraphQLDateTime)
  triggerAt!: Date;

  @Field(() => [String])
  channels!: string[];

  @Field(() => ReviewReminderPhase)
  phase!: ReviewReminderPhase;

  @Field()
  message!: string;
}
