import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HrService } from './service';
import { PrismaService } from '../prisma/prisma.service';

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
});
