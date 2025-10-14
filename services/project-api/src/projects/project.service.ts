import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatThread, Prisma, Project as ProjectEntity } from '@prisma/client';
import { ChatSummaryService } from './chat-summary.service';
import { SummaryResult } from '../../../../shared/ai/chat-summary';
import { PrismaService } from '../prisma/prisma.service';
import { buildBurndownSeries, calculateEvm } from '../../../../shared/metrics/evm';
import {
  ChatProvider,
  ChatSummarySearchModel,
  ChatThreadModel,
  ProjectMetricsModel,
  ProjectModel,
  ProjectStatus,
  TaskStatus,
  TimelineModel,
  TimelineTaskModel,
} from './models/project.model';
import { CreateChatThreadDto, CreateProjectDto, ListProjectsFilterDto } from './dto/project.dto';

type ProjectWithRelations = ProjectEntity & {
  tasks: {
    id: string;
    name: string;
    phaseId: string | null;
    status: string;
    startDate: Date;
    endDate: Date;
    orderIndex: number;
  }[];
  chatThreads: ChatThreadWithMessages[];
  burndown: {
    label: string;
    planned: number;
    actual: number;
    orderIndex: number;
  }[];
  risks: {
    id: string;
    probability: number;
    impact: number;
    status: string;
    summary: string | null;
  }[];
  phases: {
    id: string;
    name: string;
    sortOrder: number;
  }[];
};

const projectStatusMap: Record<string, ProjectStatus> = {
  draft: ProjectStatus.Draft,
  active: ProjectStatus.Active,
  onHold: ProjectStatus.OnHold,
  completed: ProjectStatus.Completed,
  cancelled: ProjectStatus.Cancelled,
};

const taskStatusMap: Record<string, TaskStatus> = {
  todo: TaskStatus.Todo,
  inProgress: TaskStatus.InProgress,
  review: TaskStatus.Review,
  done: TaskStatus.Done,
  blocked: TaskStatus.Blocked,
};

const chatProviderMap: Record<string, ChatProvider> = {
  Slack: ChatProvider.Slack,
  Teams: ChatProvider.Teams,
};

type ChatThreadWithMessages = ChatThread & {
  messages: {
    id: string;
    author: string;
    content: string;
    postedAt: Date;
  }[];
};

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService, private readonly chatSummary: ChatSummaryService) {}

  async listProjects(filter: ListProjectsFilterDto = {}): Promise<ProjectModel[]> {
    const where: Prisma.ProjectWhereInput = filter.status
      ? {
          status: filter.status,
        }
      : {};
    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return projects.map((project) => this.toProjectModel(project));
  }

  async createProject(dto: CreateProjectDto): Promise<ProjectModel> {
    const created = await this.prisma.project.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: 'draft',
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    return this.toProjectModel(created);
  }

  async getProject(id: string): Promise<ProjectModel> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return this.toProjectModel(project);
  }

  async getTimeline(projectId: string): Promise<TimelineModel> {
    const project = await this.findProjectWithRelations(projectId);
    const metrics = calculateEvm({
      plannedValue: project.plannedValue,
      earnedValue: project.earnedValue,
      actualCost: project.actualCost,
    });

    const tasks: TimelineTaskModel[] = project.tasks
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task) => ({
        id: task.id,
        name: task.name,
        phase: this.resolvePhaseName(project, task.phaseId),
        startDate: task.startDate.toISOString().slice(0, 10),
        endDate: task.endDate.toISOString().slice(0, 10),
        status: this.mapTaskStatus(task.status),
      }));

    const chatSummary = await this.resolveChatSummary(project);

    return {
      projectId,
      tasks,
      phases: project.phases
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((phase) => ({ id: phase.id, name: phase.name, sortOrder: phase.sortOrder })),
      metrics,
      chatSummary: chatSummary?.summary ?? undefined,
      chatSummaryLanguage: chatSummary?.language,
    };
  }

  async getMetrics(projectId: string): Promise<ProjectMetricsModel> {
    const project = await this.findProjectWithRelations(projectId);
    const evm = calculateEvm({
      plannedValue: project.plannedValue,
      earnedValue: project.earnedValue,
      actualCost: project.actualCost,
    });
    const burndown = buildBurndownSeries(
      project.burndown
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((point) => ({
          label: point.label,
          planned: point.planned,
          actual: point.actual,
        })),
    );

    return {
      projectId,
      evm,
      burndown,
      risks: project.risks.map((risk) => ({
        id: risk.id,
        probability: risk.probability,
        impact: risk.impact,
        status: risk.status,
      })),
    };
  }

  async createChatThread(projectId: string, dto: CreateChatThreadDto): Promise<ChatThreadModel> {
    await this.ensureProjectExists(projectId);
    const thread = await this.prisma.chatThread.create({
      data: {
        projectId,
        provider: dto.provider,
        externalThreadId: this.buildExternalThreadId(dto),
        channelName: dto.channelName,
      },
    });

    return this.toChatThreadModel(thread);
  }

  async listChatThreads(projectId: string): Promise<ChatThreadModel[]> {
    await this.ensureProjectExists(projectId);
    const threads = await this.prisma.chatThread.findMany({
      where: { projectId },
      include: { messages: true },
    });
    return threads.map((thread) => this.toChatThreadModel(thread));
  }

  async searchChatSummaries(
    projectId: string,
    keyword: string,
    options: { top?: number; minScore?: number } = {},
  ): Promise<ChatSummarySearchModel[]> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return [];
    }
    await this.ensureProjectExists(projectId);

    const limit = Math.min(Math.max(options.top ?? 5, 1), 20);
    const minScore = options.minScore ?? 0.2;

    const vectorMatches = await this.chatSummary.searchSummaries(projectId, trimmed, {
      topK: limit,
      minScore,
    });

    const vectorThreadIds = vectorMatches.map((match) => match.threadId);
    const threadsFromVector = vectorThreadIds.length
      ? await this.prisma.chatThread.findMany({
          where: { id: { in: vectorThreadIds } },
          select: {
            id: true,
            provider: true,
            channelName: true,
            summary: true,
            summaryLanguage: true,
            projectId: true,
          },
        })
      : [];

    const threadMap = new Map(threadsFromVector.map((thread) => [thread.id, thread]));
    const ranked: ChatSummarySearchModel[] = [];
    for (const match of vectorMatches) {
      const thread = threadMap.get(match.threadId);
      if (!thread) {
        continue;
      }
      ranked.push({
        threadId: thread.id,
        provider: this.mapProvider(thread.provider),
        channelName: thread.channelName ?? undefined,
        summary: thread.summary ?? match.summary,
        summaryLanguage: thread.summaryLanguage ?? undefined,
        score: Number(match.score?.toFixed(4) ?? 0),
      });
    }

    if (ranked.length >= limit) {
      return ranked.slice(0, limit);
    }

    const remaining = limit - ranked.length;
    const fallbackThreads = await this.prisma.chatThread.findMany({
      where: {
        projectId,
        summary: { contains: trimmed },
        id: vectorThreadIds.length ? { notIn: vectorThreadIds } : undefined,
      },
      orderBy: { updatedAt: 'desc' },
      take: remaining,
      select: {
        id: true,
        provider: true,
        channelName: true,
        summary: true,
        summaryLanguage: true,
      },
    });

    fallbackThreads.forEach((thread) => {
      ranked.push({
        threadId: thread.id,
        provider: this.mapProvider(thread.provider),
        channelName: thread.channelName ?? undefined,
        summary: thread.summary ?? '',
        summaryLanguage: thread.summaryLanguage ?? undefined,
        score: Number((Math.max(minScore / 2, 0.05)).toFixed(4)),
      });
    });

    return ranked.slice(0, limit);
  }

  private async findProjectWithRelations(projectId: string): Promise<ProjectWithRelations> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
        phases: true,
        chatThreads: {
          include: {
            messages: {
              orderBy: { postedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        burndown: {
          orderBy: { orderIndex: 'asc' },
        },
        risks: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  private async resolveChatSummary(project: ProjectWithRelations): Promise<SummaryResult | null> {
    const primaryThread = project.chatThreads[0];
    if (!primaryThread) {
      const fallback = project.description ? `No chat thread. ${project.description}` : null;
      if (!fallback) {
        return null;
      }
      return {
        summary: fallback,
        embedding: [],
        language: this.chatSummaryLanguageFallback(project),
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
      };
    }

    if (primaryThread.summary) {
      const existingLanguage = (primaryThread as { summaryLanguage?: string }).summaryLanguage;
      const normalizedLanguage: 'ja' | 'en' = existingLanguage === 'en' ? 'en' : 'ja';
      const existingUsage = this.toSummaryUsage((primaryThread as { summaryUsage?: string }).summaryUsage ?? undefined);
      return {
        summary: primaryThread.summary,
        embedding: this.toNumericVector(primaryThread.summaryEmbedding),
        language: normalizedLanguage,
        usage:
          existingUsage ?? {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
          },
      };
    }

    if (primaryThread.messages.length === 0) {
      return null;
    }

    const summary = await this.chatSummary.summarize(
      primaryThread.messages.map((message) => ({
        author: message.author,
        content: message.content,
        postedAt: message.postedAt.toISOString(),
      })),
      {
        projectId: project.id,
        threadId: primaryThread.id,
      },
    );

    await this.prisma.chatThread.update({
      where: { id: primaryThread.id },
      data: {
        summary: summary.summary,
        summaryEmbedding: JSON.stringify(summary.embedding),
        summaryLanguage: summary.language,
        summaryUsage: JSON.stringify(summary.usage),
      },
    });

    return summary;
  }

  private chatSummaryLanguageFallback(project: ProjectWithRelations): 'ja' | 'en' {
    return project.description && /[\u3040-\u30ff\u4e00-\u9faf]/.test(project.description) ? 'ja' : 'en';
  }

  private async ensureProjectExists(projectId: string) {
    const exists = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }

  private toProjectModel(project: ProjectEntity): ProjectModel {
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description ?? undefined,
      status: this.mapProjectStatus(project.status),
      startDate: project.startDate.toISOString().slice(0, 10),
      endDate: project.endDate ? project.endDate.toISOString().slice(0, 10) : undefined,
      evm: calculateEvm({
        plannedValue: project.plannedValue,
        earnedValue: project.earnedValue,
        actualCost: project.actualCost,
      }),
    };
  }

  private toChatThreadModel(
    thread: ChatThread & {
      summaryEmbedding: string | null;
      summaryLanguage?: string | null;
      summaryUsage?: unknown;
    },
  ): ChatThreadModel {
    return {
      id: thread.id,
      provider: this.mapProvider(thread.provider),
      externalThreadId: thread.externalThreadId,
      summaryEmbedding: this.toNumericVector(thread.summaryEmbedding),
      channelName: thread.channelName ?? undefined,
      summaryLanguage: thread.summaryLanguage ?? undefined,
      summaryUsage: this.toSummaryUsage(thread.summaryUsage),
    };
  }

  private buildExternalThreadId(dto: CreateChatThreadDto) {
    if (dto.channelName) {
      const slug = dto.channelName.replace(/\s+/g, '-').toLowerCase();
      return `${dto.provider}-${slug}-${Date.now()}`;
    }
    return `${dto.provider}-thread-${Date.now()}`;
  }

  private toNumericVector(value: string | null | undefined): number[] {
    if (!value) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
          .filter((num): num is number => Number.isFinite(num));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  private toSummaryUsage(
    value: unknown,
  ): { totalTokens: number; promptTokens: number; completionTokens: number } | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
    const totalTokens = Number(record.totalTokens ?? record.total_tokens ?? 0);
    const promptTokens = Number(record.promptTokens ?? record.prompt_tokens ?? 0);
    const completionTokens = Number(record.completionTokens ?? record.completion_tokens ?? 0);
    if ([totalTokens, promptTokens, completionTokens].every((num) => Number.isFinite(num))) {
      return { totalTokens, promptTokens, completionTokens };
    }
    return undefined;
  }

  private mapProjectStatus(value: string): ProjectStatus {
    return projectStatusMap[value] ?? ProjectStatus.Draft;
  }

  private mapTaskStatus(value: string): TaskStatus {
    return taskStatusMap[value] ?? TaskStatus.Todo;
  }

  private mapProvider(value: string): ChatProvider {
    return chatProviderMap[value] ?? ChatProvider.Slack;
  }

  private resolvePhaseName(project: ProjectWithRelations, phaseId: string | null): string | undefined {
    if (!phaseId) {
      return undefined;
    }
    const phase = project.phases.find((item) => item.id === phaseId);
    return phase?.name;
  }
}
