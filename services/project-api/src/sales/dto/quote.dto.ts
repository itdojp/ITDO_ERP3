import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class QuoteItemModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  productCode!: string;

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

  @Field(() => [QuoteItemModel])
  items!: QuoteItemModel[];
}

@InputType()
export class QuoteItemInput {
  @Field(() => String)
  productCode!: string;

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
}

@InputType()
export class SubmitQuoteInput {
  @Field(() => ID)
  quoteId!: string;

  @Field(() => String, { nullable: true })
  approverId?: string;
}
