import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeModel, UpsertEmployeeInput } from './dto/employee.dto';
import {
  CreateReviewCycleInput,
  ReviewCycleModel,
  ReviewReminderModel,
  ReviewReminderPhase,
} from './dto/review-cycle.dto';
import { SkillTagModel, SkillTagSuggestionModel, SuggestSkillTagsInput } from './dto/skill-tag.dto';

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

  async generateReviewReminders(cycleId: string): Promise<ReviewReminderModel[]> {
    const cycle = await this.prisma.reviewCycle.findUnique({
      where: { id: cycleId },
      include: { participants: true },
    });

    if (!cycle) {
      throw new NotFoundException(`Review cycle ${cycleId} not found.`);
    }
    if (cycle.participants.length === 0) {
      return [];
    }
    if (cycle.endDate <= cycle.startDate) {
      throw new BadRequestException('Review cycle endDate must be after startDate to schedule reminders.');
    }

    const dayMs = 86_400_000;
    const totalDays = Math.max(
      1,
      Math.round((cycle.endDate.getTime() - cycle.startDate.getTime()) / dayMs),
    );
    const clampOffset = (offset: number): number => {
      if (totalDays <= 1) {
        return 0;
      }
      return Math.min(Math.max(offset, 0), totalDays - 1);
    };

    const checkpoints = [
      {
        phase: ReviewReminderPhase.KICKOFF,
        offset: 0,
        message: `評価サイクル「${cycle.cycleName}」が開始しました。評価入力を開始してください。`,
      },
      {
        phase: ReviewReminderPhase.MIDPOINT,
        offset: Math.max(1, Math.floor(totalDays / 2)),
        message: `評価サイクル「${cycle.cycleName}」の中間リマインドです。進捗を更新してください。`,
      },
      {
        phase: ReviewReminderPhase.FINAL,
        offset: Math.max(1, totalDays - 2),
        message: `評価サイクル「${cycle.cycleName}」の締切が迫っています。残タスクを完了してください。`,
      },
    ];

    const reminders: ReviewReminderModel[] = [];
    for (const participant of cycle.participants) {
      for (const checkpoint of checkpoints) {
        const offsetDays = clampOffset(checkpoint.offset);
        const triggerAt = new Date(cycle.startDate.getTime() + offsetDays * dayMs);
        reminders.push({
          cycleId: cycle.id,
          participantId: participant.employeeId,
          triggerAt,
          channels: ['slack', 'email'],
          phase: checkpoint.phase,
          message: checkpoint.message,
        });
      }
    }

    return reminders.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
  }

  async suggestSkillTags(input: SuggestSkillTagsInput): Promise<SkillTagSuggestionModel[]> {
    const profile = input.profile.toLowerCase();
    const tokens = new Set(profile.split(/[^a-z0-9+#]/i).filter(Boolean));
    const seedTags = new Set((input.seedTags ?? []).map((tag) => tag.toLowerCase()));
    const includeSeedTags = input.includeSeedTags ?? false;
    const limit = input.limit ?? 10;

    const skillTags = await this.listSkillTags();
    const suggestions: SkillTagSuggestionModel[] = [];

    for (const tag of skillTags) {
      const keywords = this.extractSkillKeywords(tag);
      const matches = Array.from(
        new Set(
          keywords.filter((keyword) => {
            const normalized = keyword.toLowerCase();
            if (!normalized) {
              return false;
            }
            if (profile.includes(normalized)) {
              return true;
            }
            if (tokens.has(normalized.replace(/\s+/g, ''))) {
              return true;
            }
            return false;
          }),
        ),
      );

      const isSeed = seedTags.has(tag.tag.toLowerCase());
      if (!matches.length && !isSeed) {
        continue;
      }
      if (isSeed && !includeSeedTags && matches.length === 0) {
        continue;
      }

      const occurrenceScore = matches.length ? Math.min(matches.length / 3, 1) : 0;
      const weightScore = Math.min(Math.max(tag.weight, 0), 1);
      let confidence = 0.5 * occurrenceScore + 0.4 * weightScore;
      if (isSeed) {
        confidence += 0.1;
      }
      if (matches.length === 0 && isSeed) {
        confidence = Math.min(1, 0.2 + 0.4 * weightScore);
      }

      suggestions.push({
        tag: tag.tag,
        description: tag.description,
        category: tag.category,
        confidence: Number(Math.min(1, confidence).toFixed(2)),
        matchedKeywords: matches,
      });
    }

    return suggestions
      .sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        return a.tag.localeCompare(b.tag);
      })
      .slice(0, limit);
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

  private extractSkillKeywords(tag: SkillTagModel): string[] {
    const keywords = new Set<string>();
    keywords.add(tag.tag);
    keywords.add(tag.tag.replace(/_/g, ' '));
    const fragments = tag.description.split(/[\s,、/・|]+/);
    for (const fragment of fragments) {
      const keyword = fragment.trim();
      if (keyword) {
        keywords.add(keyword);
      }
    }
    return Array.from(keywords);
  }
}
