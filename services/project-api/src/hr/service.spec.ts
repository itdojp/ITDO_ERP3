import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HrService } from './service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewReminderPhase } from './dto/review-cycle.dto';

type PrismaMock = {
  skillTag: {
    findMany: jest.Mock;
  };
  employee: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  reviewCycle: {
    findMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
  };
};

describe('HrService', () => {
  let prisma: PrismaMock;
  let service: HrService;

  beforeEach(() => {
    prisma = {
      skillTag: {
        findMany: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      reviewCycle: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new HrService(prisma as unknown as PrismaService);
  });

  describe('listSkillTags', () => {
    it('returns mapped skill tag models ordered by weight', async () => {
      prisma.skillTag.findMany.mockResolvedValue([
        { tag: 'nestjs', description: 'NestJS', category: 'backend', weight: 0.8 },
        { tag: 'ai', description: 'AI Prompting', category: 'ai', weight: 0.6 },
      ]);

      const result = await service.listSkillTags();

      expect(prisma.skillTag.findMany).toHaveBeenCalledWith({
        orderBy: [{ weight: 'desc' }, { tag: 'asc' }],
      });
      expect(result).toEqual([
        {
          tag: 'nestjs',
          description: 'NestJS',
          category: 'backend',
          weight: 0.8,
        },
        {
          tag: 'ai',
          description: 'AI Prompting',
          category: 'ai',
          weight: 0.6,
        },
      ]);
    });
  });

  describe('upsertEmployee', () => {
    const skillTags = [
      { id: 'tag-1', tag: 'project_management' },
      { id: 'tag-2', tag: 'nestjs' },
    ];

    it('creates a new employee with skill tag relations', async () => {
      prisma.skillTag.findMany.mockResolvedValue(skillTags);
      prisma.employee.create.mockResolvedValue({
        id: 'emp-1',
        name: 'Mina Kato',
        email: 'mina.kato@itdo.example.com',
        skills: [
          { skillTag: { tag: 'project_management' } },
          { skillTag: { tag: 'nestjs' } },
        ],
      });

      const result = await service.upsertEmployee({
        name: 'Mina Kato',
        email: 'mina.kato@itdo.example.com',
        skillTags: ['project_management', 'nestjs', 'project_management'],
      });

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: {
          name: 'Mina Kato',
          email: 'mina.kato@itdo.example.com',
          skills: {
            create: [{ skillTagId: 'tag-1' }, { skillTagId: 'tag-2' }],
          },
        },
        include: { skills: { include: { skillTag: true } } },
      });
      expect(result).toEqual({
        id: 'emp-1',
        name: 'Mina Kato',
        email: 'mina.kato@itdo.example.com',
        skillTags: ['project_management', 'nestjs'],
      });
    });

    it('updates an existing employee and replaces skill tags', async () => {
      prisma.skillTag.findMany.mockResolvedValue([skillTags[1]]);
      prisma.employee.update.mockResolvedValue({
        id: 'emp-1',
        name: 'Mina Kato',
        email: 'mina.kato@itdo.example.com',
        skills: [{ skillTag: { tag: 'nestjs' } }],
      });

      const result = await service.upsertEmployee({
        id: 'emp-1',
        name: 'Mina Kato',
        email: 'mina.kato@itdo.example.com',
        skillTags: ['nestjs'],
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: {
          name: 'Mina Kato',
          email: 'mina.kato@itdo.example.com',
          skills: {
            deleteMany: {},
            create: [{ skillTagId: 'tag-2' }],
          },
        },
        include: { skills: { include: { skillTag: true } } },
      });
      expect(result.skillTags).toEqual(['nestjs']);
    });

    it('throws when skill tags are missing', async () => {
      prisma.skillTag.findMany.mockResolvedValue([skillTags[0]]);

      await expect(
        service.upsertEmployee({
          name: 'Mina Kato',
          email: 'mina.kato@itdo.example.com',
          skillTags: ['project_management', 'nestjs'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listEmployees', () => {
    it('returns employees with skill tag names', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          name: 'Mina Kato',
          email: 'mina.kato@itdo.example.com',
          skills: [
            { skillTag: { tag: 'project_management' } },
            { skillTag: { tag: 'nestjs' } },
          ],
        },
      ]);

      const employees = await service.listEmployees();

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
        include: { skills: { include: { skillTag: true } } },
      });
      expect(employees).toEqual([
        {
          id: 'emp-1',
          name: 'Mina Kato',
          email: 'mina.kato@itdo.example.com',
          skillTags: ['project_management', 'nestjs'],
        },
      ]);
    });
  });

  describe('review cycles', () => {
    it('lists review cycles with participant ids', async () => {
      prisma.reviewCycle.findMany.mockResolvedValue([
        {
          id: 'cycle-1',
          cycleName: 'FY2025-H1',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-06-30'),
          participants: [
            { employeeId: 'emp-1' },
            { employeeId: 'emp-2' },
          ],
        },
      ]);

      const cycles = await service.listReviewCycles();

      expect(prisma.reviewCycle.findMany).toHaveBeenCalledWith({
        orderBy: { startDate: 'desc' },
        include: { participants: true },
      });
      expect(cycles[0].participantIds).toEqual(['emp-1', 'emp-2']);
    });

    it('creates a review cycle with participants', async () => {
      prisma.employee.count.mockResolvedValue(2);
      prisma.reviewCycle.create.mockResolvedValue({
        id: 'cycle-1',
        cycleName: 'FY2025-H1',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        participants: [
          { employeeId: 'emp-1' },
          { employeeId: 'emp-2' },
        ],
      });

      const result = await service.createReviewCycle({
        cycleName: 'FY2025-H1',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        participantIds: ['emp-1', 'emp-2'],
      });

      expect(prisma.reviewCycle.create).toHaveBeenCalledWith({
        data: {
          cycleName: 'FY2025-H1',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-06-30'),
          participants: {
            create: [{ employeeId: 'emp-1' }, { employeeId: 'emp-2' }],
          },
        },
        include: { participants: true },
      });
      expect(result.participantIds).toEqual(['emp-1', 'emp-2']);
    });

    it('throws when participant list is empty', async () => {
      await expect(
        service.createReviewCycle({
          cycleName: 'FY2025-H1',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-06-30'),
          participantIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when participant ids include unknown employees', async () => {
      prisma.employee.count.mockResolvedValue(1);

      await expect(
        service.createReviewCycle({
          cycleName: 'FY2025-H1',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-06-30'),
          participantIds: ['emp-1', 'emp-2'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateReviewReminders', () => {
    it('builds reminders for each participant and phase', async () => {
      const startDate = new Date('2025-04-01T00:00:00Z');
      const endDate = new Date('2025-05-01T00:00:00Z');
      prisma.reviewCycle.findUnique.mockResolvedValue({
        id: 'cycle-1',
        cycleName: 'FY2025-H1',
        startDate,
        endDate,
        participants: [{ employeeId: 'emp-1' }, { employeeId: 'emp-2' }],
      });

      const reminders = await service.generateReviewReminders('cycle-1');

      expect(prisma.reviewCycle.findUnique).toHaveBeenCalledWith({
        where: { id: 'cycle-1' },
        include: { participants: true },
      });
      expect(reminders).toHaveLength(6);
      expect(reminders[0]).toEqual(
        expect.objectContaining({
          phase: ReviewReminderPhase.KICKOFF,
          participantId: 'emp-1',
          channels: ['slack', 'email'],
        }),
      );
      expect(reminders.at(-1)?.phase).toBe(ReviewReminderPhase.FINAL);
    });

    it('throws when cycle is missing', async () => {
      prisma.reviewCycle.findUnique.mockResolvedValue(null);

      await expect(service.generateReviewReminders('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggestSkillTags', () => {
    it('ranks skill tags based on profile text matches and weight', async () => {
      prisma.skillTag.findMany.mockResolvedValue([
        { id: 'tag-1', tag: 'nestjs', description: 'NestJS, TypeScript, GraphQL', category: 'backend', weight: 0.9 },
        { id: 'tag-2', tag: 'react', description: 'React / TypeScript UI', category: 'frontend', weight: 0.6 },
        { id: 'tag-3', tag: 'prompt_engineering', description: 'Prompt design, LangChain', category: 'ai', weight: 0.5 },
      ]);

      const suggestions = await service.suggestSkillTags({
        profile: '経験: NestJS と GraphQL でREST/GraphQL API開発。LangChainでAIワークフローも構築。',
        seedTags: ['prompt_engineering'],
        includeSeedTags: true,
      });

      expect(prisma.skillTag.findMany).toHaveBeenCalled();
      expect(suggestions[0].tag).toBe('nestjs');
      expect(suggestions[0].matchedKeywords).toContain('NestJS');
      expect(suggestions.find((item) => item.tag === 'prompt_engineering')?.matchedKeywords).toContain('LangChain');
      expect(suggestions).toHaveLength(2);
    });

    it('honors limit and ignores unmatched seed tags when includeSeedTags is false', async () => {
      prisma.skillTag.findMany.mockResolvedValue([
        { id: 'tag-1', tag: 'nestjs', description: 'NestJS', category: 'backend', weight: 0.9 },
        { id: 'tag-2', tag: 'react', description: 'React', category: 'frontend', weight: 0.6 },
        { id: 'tag-3', tag: 'python', description: 'Python', category: 'backend', weight: 0.7 },
      ]);

      const suggestions = await service.suggestSkillTags({
        profile: 'フロントエンドではReact、バックエンドではNestJSを担当しています。',
        seedTags: ['python'],
        limit: 2,
      });

      expect(suggestions).toHaveLength(2);
      expect(suggestions.map((s) => s.tag)).toEqual(expect.arrayContaining(['nestjs', 'react']));
      expect(suggestions.find((s) => s.tag === 'python')).toBeUndefined();
    });
  });
});
