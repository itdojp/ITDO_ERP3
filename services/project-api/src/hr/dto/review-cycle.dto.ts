import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';

const ISODateTimeScalar = GraphQLDateTime as unknown as GraphQLScalarType<Date, string>;

@ObjectType()
export class ReviewCycleModel {
  @Field(() => ID)
  id!: string;

  @Field()
  cycleName!: string;

  @Field(() => ISODateTimeScalar)
  startDate!: Date;

  @Field(() => ISODateTimeScalar)
  endDate!: Date;

  @Field(() => [String])
  participantIds!: string[];
}

@InputType()
export class CreateReviewCycleInput {
  @Field()
  cycleName!: string;

  @Field(() => ISODateTimeScalar)
  startDate!: Date;

  @Field(() => ISODateTimeScalar)
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

  @Field(() => ISODateTimeScalar)
  triggerAt!: Date;

  @Field(() => [String])
  channels!: string[];

  @Field(() => ReviewReminderPhase)
  phase!: ReviewReminderPhase;

  @Field()
  message!: string;
}
