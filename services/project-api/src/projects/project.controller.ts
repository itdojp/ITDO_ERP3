import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ProjectCollectionModel,
  ProjectMetricsModel,
  ProjectModel,
  TimelineModel,
} from './models/project.model';
import { ProjectService } from './project.service';
import { ChatSummarySearchDto, CreateChatThreadDto, CreateProjectDto, ListProjectsFilterDto } from './dto/project.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async listProjects(@Query() filter: ListProjectsFilterDto): Promise<ProjectCollectionModel> {
    const projects = await this.projectService.listProjects(filter);
    return { data: projects };
  }

  @Post()
  createProject(@Body() dto: CreateProjectDto): Promise<ProjectModel> {
    return this.projectService.createProject(dto);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') projectId: string): Promise<TimelineModel> {
    return this.projectService.getTimeline(projectId);
  }

  @Get(':id/metrics')
  getMetrics(@Param('id') projectId: string): Promise<ProjectMetricsModel> {
    return this.projectService.getMetrics(projectId);
  }

  @Post(':id/chat/threads')
  async createThread(@Param('id') projectId: string, @Body() dto: CreateChatThreadDto) {
    const thread = await this.projectService.createChatThread(projectId, dto);
    return thread;
  }

  @Get(':id/chat/summary-search')
  async searchSummaries(@Param('id') projectId: string, @Query() query: ChatSummarySearchDto) {
    if (!query.q || !query.q.trim()) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    return this.projectService.searchChatSummaries(projectId, query.q, {
      top: query.top,
      minScore: query.minScore,
    });
  }
}
