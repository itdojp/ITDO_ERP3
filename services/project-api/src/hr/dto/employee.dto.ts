import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmployeeModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => [String])
  skillTags!: string[];
}

@InputType()
export class UpsertEmployeeInput {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => [String])
  skillTags!: string[];
}
