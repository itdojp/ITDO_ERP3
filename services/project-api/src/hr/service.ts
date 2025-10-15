import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeModel, UpsertEmployeeInput } from './dto/employee.dto';
import { CreateReviewCycleInput, ReviewCycleModel } from './dto/review-cycle.dto';
import { SkillTagModel } from './dto/skill-tag.dto';

type EmployeeWithSkills = Prisma.EmployeeGetPayload<{
  include: { skills: { include: { skillTag: true } } };
}>;

type ReviewCycleWithParticipants = Prisma.ReviewCycleGetPayload<{
  include: { participants: true };
}>;

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  async listSkillTags(): Promise<SkillTagModel[]> {
    const records = await this.prisma.skillTag.findMany({
      orderBy: [{ weight: 'desc' }, { tag: 'asc' }],
    });
    return records.map((record) => this.mapSkillTag(record));
  }

  async listEmployees(): Promise<EmployeeModel[]> {
    const employees = await this.prisma.employee.findMany({
      orderBy: { createdAt: 'asc' },
      include: { skills: { include: { skillTag: true } } },
    });
    return employees.map((employee) => this.mapEmployee(employee));
  }

  async upsertEmployee(input: UpsertEmployeeInput): Promise<EmployeeModel> {
    const uniqueTags = Array.from(new Set(input.skillTags));
    const tagRecords = await this.prisma.skillTag.findMany({
      where: { tag: { in: uniqueTags } },
    });

    if (tagRecords.length !== uniqueTags.length) {
      const found = new Set(tagRecords.map((tag) => tag.tag));
      const missing = uniqueTags.filter((tag) => !found.has(tag));
      throw new NotFoundException(`Skill tags not found: ${missing.join(', ')}`);
    }

    const skillTagMap = new Map(tagRecords.map((tag) => [tag.tag, tag.id]));

    if (input.id) {
      const employee = await this.prisma.employee.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          skills: {
            deleteMany: {},
            create: uniqueTags.map((tag) => ({
              skillTagId: skillTagMap.get(tag)!,
            })),
          },
        },
        include: { skills: { include: { skillTag: true } } },
      });

      return this.mapEmployee(employee);
    }

    const employee = await this.prisma.employee.create({
      data: {
        name: input.name,
        email: input.email,
        skills: {
          create: uniqueTags.map((tag) => ({
            skillTagId: skillTagMap.get(tag)!,
          })),
        },
      },
      include: { skills: { include: { skillTag: true } } },
    });

    return this.mapEmployee(employee);
  }

  async listReviewCycles(): Promise<ReviewCycleModel[]> {
    const cycles = await this.prisma.reviewCycle.findMany({
      orderBy: { startDate: 'desc' },
      include: { participants: true },
    });
    return cycles.map((cycle) => this.mapReviewCycle(cycle));
  }

  async createReviewCycle(input: CreateReviewCycleInput): Promise<ReviewCycleModel> {
    const participantIds = Array.from(new Set(input.participantIds));
    if (participantIds.length === 0) {
      throw new BadRequestException('At least one participant is required to create a review cycle.');
    }

    const participantCount = await this.prisma.employee.count({
      where: { id: { in: participantIds } },
    });
    if (participantCount !== participantIds.length) {
      throw new NotFoundException('One or more participant IDs are invalid.');
    }

    const cycle = await this.prisma.reviewCycle.create({
      data: {
        cycleName: input.cycleName,
        startDate: input.startDate,
        endDate: input.endDate,
        participants: {
          create: participantIds.map((employeeId) => ({ employeeId })),
        },
      },
      include: { participants: true },
    });

    return this.mapReviewCycle(cycle);
  }

  private mapSkillTag(record: SkillTag): SkillTagModel {
    return {
      tag: record.tag,
      description: record.description,
      category: record.category,
      weight: record.weight,
    };
  }

  private mapEmployee(employee: EmployeeWithSkills): EmployeeModel {
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      skillTags: employee.skills.map((assignment) => assignment.skillTag.tag),
    };
  }

  private mapReviewCycle(cycle: ReviewCycleWithParticipants): ReviewCycleModel {
    return {
      id: cycle.id,
      cycleName: cycle.cycleName,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      participantIds: cycle.participants.map((participant) => participant.employeeId),
    };
  }
}
