import { NotFoundException } from '@nestjs/common';
import { ChatSummaryService } from './chat-summary.service';
import { ProjectService } from './project.service';
import { ChatProvider, ProjectStatus, TaskStatus } from './models/project.model';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectService', () => {
  const baseProject = {
    id: 'proj-1001',
    code: 'ALPHA-01',
    name: 'Alpha Launch Enablement',
    description: 'ERP rollout for core operations.',
    status: 'active',
    startDate: new Date('2025-01-15'),
    endDate: new Date('2025-07-31'),
    plannedValue: 120000,
    earnedValue: 112500,
    actualCost: 105000,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const projectWithRelations = {
    ...baseProject,
    tasks: [
      {
        id: 'task-1',
        projectId: baseProject.id,
        phaseId: null,
        name: 'Kickoff & Alignment',
        description: null,
        status: 'done',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-22'),
        effortHours: 40,
        orderIndex: 1,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
    ],
    chatThreads: [
      {
        id: 'thread-1',
        projectId: baseProject.id,
        provider: 'Slack',
        externalThreadId: 'alpha-thread-001',
        channelName: 'alpha-daily-sync',
        summary: null,
        summaryEmbedding: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            author: 'PM',
            content: 'Finance integration is on track.',
            postedAt: new Date('2025-02-10T09:00:00Z'),
            createdAt: new Date('2025-02-10T09:00:00Z'),
            updatedAt: new Date('2025-02-10T09:00:00Z'),
          },
        ],
      },
    ],
    burndown: [
      {
        id: 'bd-1',
        projectId: baseProject.id,
        label: 'Sprint 1',
        planned: 120,
        actual: 118,
        orderIndex: 1,
      },
    ],
    risks: [
      {
        id: 'risk-1',
        projectId: baseProject.id,
        probability: 40,
        impact: 3,
        status: 'monitoring',
        summary: 'Integration readiness',
      },
    ],
    phases: [
      {
        id: 'phase-alpha-init',
        projectId: baseProject.id,
        name: 'Initiation',
        sortOrder: 1,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-31'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: 'phase-alpha-exec',
        projectId: baseProject.id,
        name: 'Execution',
        sortOrder: 2,
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-06-30'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
    ],
  };

  let prismaMock: {
    project: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    chatThread: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  let chatSummaryMock: jest.Mocked<ChatSummaryService>;
  let service: ProjectService;

  beforeEach(() => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockResolvedValue([baseProject]),
        create: jest.fn().mockImplementation(async ({ data }: { data: any }) => ({
          ...baseProject,
          ...data,
          id: 'proj-new',
          status: 'draft',
          startDate: data.startDate,
          endDate: data.endDate,
          plannedValue: 0,
          earnedValue: 0,
          actualCost: 0,
        })),
        findUnique: jest.fn().mockImplementation(async (args: any) => {
          if (args.where.id !== baseProject.id) {
            return null;
          }
          if (args.include) {
            return projectWithRelations;
          }
          if (args.select) {
            return { id: baseProject.id };
          }
          return baseProject;
        }),
      },
      chatThread: {
        create: jest.fn().mockImplementation(async ({ data }: { data: any }) => ({
          id: 'thread-new',
          projectId: data.projectId,
          provider: data.provider,
          externalThreadId: data.externalThreadId,
          channelName: data.channelName ?? null,
          summary: null,
          summaryEmbedding: null,
          createdAt: new Date('2025-02-12T00:00:00Z'),
          updatedAt: new Date('2025-02-12T00:00:00Z'),
        })),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'thread-1',
            projectId: baseProject.id,
            provider: 'Slack',
            externalThreadId: 'alpha-thread-001',
            channelName: 'alpha-daily-sync',
            summary: 'Daily standup summary',
            summaryEmbedding: JSON.stringify([0.1, 0.2]),
            summaryLanguage: 'ja',
            summaryUsage: JSON.stringify({ totalTokens: 10, promptTokens: 7, completionTokens: 3 }),
            createdAt: new Date('2025-01-01T00:00:00Z'),
            updatedAt: new Date('2025-01-01T00:00:00Z'),
            messages: [],
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    chatSummaryMock = {
      summarize: jest.fn().mockResolvedValue({
        summary: 'Aggregated chat summary',
        embedding: [0.42, 0.73],
        language: 'ja',
        usage: { totalTokens: 120, promptTokens: 80, completionTokens: 40 },
      }),
    } as unknown as jest.Mocked<ChatSummaryService>;

    service = new ProjectService(prismaMock as unknown as PrismaService, chatSummaryMock);
  });

  it('lists projects with status filtering and computed EVM', async () => {
    const projects = await service.listProjects({ status: ProjectStatus.Active });

    expect(prismaMock.project.findMany).toHaveBeenCalledWith({
      where: { status: ProjectStatus.Active },
      orderBy: { startDate: 'desc' },
    });
    expect(projects).toHaveLength(1);
    expect(projects[0].status).toBe(ProjectStatus.Active);
    expect(projects[0].evm.cpi).toBeGreaterThan(0);
  });

  it('creates a project with draft status by default', async () => {
    const project = await service.createProject({
      code: 'DELTA-04',
      name: 'Workflow Automation',
      startDate: '2025-03-01',
    });

    expect(prismaMock.project.create).toHaveBeenCalled();
    expect(project.status).toBe(ProjectStatus.Draft);
    expect(project.evm.plannedValue).toBe(0);
  });

  it('returns project timeline and computes chat summary on demand', async () => {
    const timeline = await service.getTimeline(baseProject.id);

    expect(chatSummaryMock.summarize).toHaveBeenCalledWith(
      [
        {
          author: 'PM',
          content: 'Finance integration is on track.',
          postedAt: '2025-02-10T09:00:00.000Z',
        },
      ],
      {
        projectId: baseProject.id,
        threadId: 'thread-1',
      },
    );
    expect(prismaMock.chatThread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: {
        summary: 'Aggregated chat summary',
        summaryEmbedding: JSON.stringify([0.42, 0.73]),
        summaryLanguage: 'ja',
        summaryUsage: JSON.stringify({ totalTokens: 120, promptTokens: 80, completionTokens: 40 }),
      },
    });
    expect(timeline.projectId).toBe(baseProject.id);
    expect(timeline.tasks[0].status).toBe(TaskStatus.Done);
    expect(timeline.chatSummary).toBe('Aggregated chat summary');
    expect(timeline.chatSummaryLanguage).toBe('ja');
  });

  it('provides burndown metrics with risks', async () => {
    const metrics = await service.getMetrics(baseProject.id);

    expect(metrics.projectId).toBe(baseProject.id);
    expect(metrics.burndown.labels).toEqual(['Sprint 1']);
    expect(metrics.risks[0].status).toBe('monitoring');
  });

  it('creates chat threads and normalizes embedding output', async () => {
    const thread = await service.createChatThread(baseProject.id, {
      provider: ChatProvider.Slack,
      channelName: 'Daily Sync',
    });

    expect(prismaMock.chatThread.create).toHaveBeenCalled();
    expect(thread.summaryEmbedding).toEqual([]);
    expect(thread.channelName).toBe('Daily Sync');
  });

  it('throws when project not found', async () => {
    await expect(service.getProject('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
