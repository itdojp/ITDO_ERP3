import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';
import { OrderModel } from './order.dto';
import { CreditReviewModel } from './credit-review.dto';

const DateTimeScalar = GraphQLDateTime as unknown as GraphQLScalarType<Date, string>;

@ObjectType()
export class QuoteItemModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  productCode!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  discountRate!: number;
}

@ObjectType()
export class QuoteModel {
  @Field(() => ID)
  id!: string;

  @Field()
  quoteNumber!: string;

  @Field(() => String)
  customerId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => Int)
  version!: number;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  submittedAt?: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  approvedAt?: Date;

  @Field(() => [QuoteItemModel])
  items!: QuoteItemModel[];

  @Field(() => OrderModel, { nullable: true })
  order?: OrderModel;

  @Field(() => [CreditReviewModel])
  creditReviews!: CreditReviewModel[];
}

@InputType()
export class QuoteItemInput {
  @Field(() => String)
  productCode!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float, { defaultValue: 0 })
  discountRate!: number;
}

@InputType()
export class CreateQuoteInput {
  @Field(() => String)
  customerId!: string;

  @Field(() => [QuoteItemInput])
  items!: QuoteItemInput[];

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => String, { nullable: true })
  quoteNumber?: string;
}

@InputType()
export class QuoteFilterInput {
  @Field(() => String, { nullable: true })
  customerId?: string;

  @Field(() => String, { nullable: true })
  status?: string;
}
