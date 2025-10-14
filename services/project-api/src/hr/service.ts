import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { EmployeeModel, UpsertEmployeeInput } from './dto/employee.dto';
import { CreateReviewCycleInput, ReviewCycleModel } from './dto/review-cycle.dto';
import { SkillTagModel } from './dto/skill-tag.dto';

const skillTagsSeedPath = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'db',
  'seeds',
  'hr',
  'skill-tags.json',
);

let cachedSkillTags: SkillTagModel[] | null = null;

function loadSkillTags(): SkillTagModel[] {
  if (!cachedSkillTags) {
    const raw = readFileSync(skillTagsSeedPath, 'utf8');
    cachedSkillTags = JSON.parse(raw) as SkillTagModel[];
  }
  return cachedSkillTags;
}

@Injectable()
export class HrService {
  private readonly employees = new Map<string, EmployeeModel>();
  private readonly reviewCycles: ReviewCycleModel[] = [];

  listSkillTags(): SkillTagModel[] {
    return loadSkillTags();
  }

  listEmployees(): EmployeeModel[] {
    return Array.from(this.employees.values());
  }

  upsertEmployee(input: UpsertEmployeeInput): EmployeeModel {
    const id = input.id ?? `emp-${Date.now()}`;
    const record: EmployeeModel = {
      id,
      name: input.name,
      email: input.email,
      skillTags: input.skillTags,
    };
    this.employees.set(id, record);
    return record;
  }

  listReviewCycles(): ReviewCycleModel[] {
    return this.reviewCycles;
  }

  createReviewCycle(input: CreateReviewCycleInput): ReviewCycleModel {
    const cycle: ReviewCycleModel = {
      id: `cycle-${Date.now()}`,
      cycleName: input.cycleName,
      startDate: input.startDate,
      endDate: input.endDate,
      participantIds: input.participantIds,
    };
    this.reviewCycles.push(cycle);
    return cycle;
  }
}
