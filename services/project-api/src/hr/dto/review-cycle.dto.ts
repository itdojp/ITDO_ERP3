import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

const ISODateTimeScalar = GraphQLISODateTime as GraphQLScalarType<Date, string>;

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
