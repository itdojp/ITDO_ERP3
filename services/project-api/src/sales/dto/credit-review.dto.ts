import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';

const DateTimeScalar = GraphQLDateTime as unknown as GraphQLScalarType<Date, string>;

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

  @Field(() => DateTimeScalar)
  requestedAt!: Date;

  @Field(() => DateTimeScalar, { nullable: true })
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
