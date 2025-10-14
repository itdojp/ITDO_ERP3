import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

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
