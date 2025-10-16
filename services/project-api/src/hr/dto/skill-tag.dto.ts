import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SkillTagModel {
  @Field()
  tag!: string;

  @Field()
  description!: string;

  @Field()
  category!: string;

  @Field(() => Float)
  weight!: number;
}
