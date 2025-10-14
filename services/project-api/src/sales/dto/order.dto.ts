import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrderModel {
  @Field(() => ID)
  id!: string;

  @Field()
  orderNumber!: string;

  @Field(() => String)
  quoteId!: string;

  @Field()
  status!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field({ nullable: true })
  signedAt?: Date;
}

@InputType()
export class CreateOrderInput {
  @Field(() => ID)
  quoteId!: string;

  @Field(() => String)
  paymentTerm!: string;

  @Field(() => Float)
  totalAmount!: number;
}
