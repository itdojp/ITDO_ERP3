/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

@ObjectType()
export class SalesMetricsModel {
  @Field(() => GraphQLISODateTime)
  generatedAt!: Date;

  @Field(() => Int)
  totalQuotes!: number;

  @Field(() => Int)
  quotesDraft!: number;

  @Field(() => Int)
  quotesPendingApproval!: number;

  @Field(() => Int)
  quotesApproved!: number;

  @Field(() => Float)
  averageQuoteValue!: number;

  @Field(() => Float)
  totalQuoteValue!: number;

  @Field(() => Int)
  totalOrders!: number;

  @Field(() => Int)
  ordersPendingFulfillment!: number;

  @Field(() => Int)
  ordersFulfilled!: number;

  @Field(() => Float)
  totalOrderValue!: number;

  @Field(() => Float, { nullable: true })
  quoteToOrderConversionRate?: number;

  @Field(() => Int)
  pendingCreditReviews!: number;

  @Field(() => Float, { nullable: true })
  averageCreditApprovalTimeHours?: number;
}

export type SalesMetricsSnapshot = SalesMetricsModel;
