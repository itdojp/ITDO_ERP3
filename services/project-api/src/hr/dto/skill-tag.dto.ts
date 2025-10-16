import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SkillTagModel {
  @Field(() => ID)
  tag!: string;

  @Field()
  description!: string;

  @Field()
  category!: string;

  @Field(() => Float)
  weight!: number;
}

@ObjectType()
export class SkillTagSuggestionModel {
  @Field(() => ID)
  tag!: string;

  @Field()
  description!: string;

  @Field()
  category!: string;

  @Field(() => Float)
  confidence!: number;

  @Field(() => [String])
  matchedKeywords!: string[];
}

@InputType()
export class SuggestSkillTagsInput {
  @Field()
  profile!: string;

  @Field(() => [String], { nullable: true })
  seedTags?: string[];

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field({ nullable: true })
  includeSeedTags?: boolean;
}
