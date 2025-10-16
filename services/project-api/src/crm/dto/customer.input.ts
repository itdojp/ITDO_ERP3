import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';

const ISODateTimeScalar = GraphQLDateTime as unknown as GraphQLScalarType<Date, string>;

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

  @Field(() => ISODateTimeScalar, { nullable: true })
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
