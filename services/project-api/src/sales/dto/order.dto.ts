import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';
import { CreditReviewModel } from './credit-review.dto';

const DateTimeScalar = GraphQLDateTime as unknown as GraphQLScalarType<Date, string>;

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

  @Field(() => DateTimeScalar, { nullable: true })
  signedAt?: Date;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
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

  @Field(() => DateTimeScalar, { nullable: true })
  signedAt?: Date;
}
