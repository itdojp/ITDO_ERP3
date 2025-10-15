import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { HrService } from './service';
import { EmployeeModel, UpsertEmployeeInput } from './dto/employee.dto';
import { CreateReviewCycleInput, ReviewCycleModel } from './dto/review-cycle.dto';
import { SkillTagModel } from './dto/skill-tag.dto';

@Resolver(() => EmployeeModel)
export class HrResolver {
  constructor(private readonly service: HrService) {}

  @Query(() => [SkillTagModel])
  skillTags(): Promise<SkillTagModel[]> {
    return this.service.listSkillTags();
  }

  @Query(() => [EmployeeModel])
  employees(): Promise<EmployeeModel[]> {
    return this.service.listEmployees();
  }

  @Mutation(() => EmployeeModel)
  upsertEmployee(@Args('input') input: UpsertEmployeeInput): Promise<EmployeeModel> {
    return this.service.upsertEmployee(input);
  }

  @Query(() => [ReviewCycleModel])
  reviewCycles(): Promise<ReviewCycleModel[]> {
    return this.service.listReviewCycles();
  }

  @Mutation(() => ReviewCycleModel)
  createReviewCycle(@Args('input') input: CreateReviewCycleInput): Promise<ReviewCycleModel> {
    return this.service.createReviewCycle(input);
  }
}
