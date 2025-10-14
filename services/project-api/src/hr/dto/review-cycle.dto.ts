import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ReviewCycleModel {
  @Field(() => ID)
  id!: string;

  @Field()
  cycleName!: string;

  @Field(() => Date)
  startDate!: Date;

  @Field(() => Date)
  endDate!: Date;

  @Field(() => [String])
  participantIds!: string[];
}

@InputType()
export class CreateReviewCycleInput {
  @Field()
  cycleName!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field(() => [ID])
  participantIds!: string[];
}
