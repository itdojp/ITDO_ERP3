/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';
import { CreditReviewModel } from './credit-review.dto';

@ObjectType()
export class OrderModel {
  @Field(() => ID)
  id!: string;

  @Field()
  orderNumber!: string;

  @Field(() => String)
  quoteId!: string;

  @Field(() => String)
  customerId!: string;

  @Field()
  status!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => String)
  paymentTerm!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  signedAt?: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => [CreditReviewModel])
  creditReviews!: CreditReviewModel[];
}

@InputType()
export class CreateOrderInput {
  @Field(() => ID)
  quoteId!: string;

  @Field(() => String, { nullable: true })
  orderNumber?: string;

  @Field(() => String)
  paymentTerm!: string;

  @Field(() => Float, { nullable: true })
  totalAmount?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  signedAt?: Date;
}
