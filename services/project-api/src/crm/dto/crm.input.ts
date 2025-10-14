/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { GraphQLISODateTime } from 'graphql-scalars';

@InputType()
export class CustomerFilterInput {
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => String, { nullable: true })
  type?: string;

  @Field(() => String, { nullable: true })
  industry?: string;
}

@InputType()
export class CreateCustomerInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  type?: string;

  @Field(() => String, { nullable: true })
  industry?: string;

  @Field(() => String, { nullable: true })
  ownerUserId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class UpdateCustomerInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  type?: string;

  @Field(() => String, { nullable: true })
  industry?: string;

  @Field(() => String, { nullable: true })
  ownerUserId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class CreateOpportunityInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  stage?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => Int, { nullable: true })
  probability?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expectedClose?: Date;
}

@InputType()
export class AddInteractionNoteInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  contactId?: string;

  @Field(() => ID, { nullable: true })
  opportunityId?: string;

  @Field(() => String)
  channel!: string;

  @Field(() => String)
  rawText!: string;

  @Field(() => String, { nullable: true })
  summaryText?: string;

  @Field(() => [String], { nullable: true })
  followups?: string[];

  @Field(() => Float, { nullable: true })
  confidence?: number;
}
