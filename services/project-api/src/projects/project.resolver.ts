import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ChatSummarySearchModel,
  ChatThreadModel,
  ProjectCollectionModel,
  ProjectMetricsModel,
  ProjectModel,
  TimelineModel,
} from './models/project.model';
import {
  CreateChatThreadInput,
  CreateProjectInput,
  ProjectFilterArgs,
} from './dto/project.dto';
import { ProjectService } from './project.service';

@Resolver(() => ProjectModel)
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => [ProjectModel])
  async projects(@Args() filter: ProjectFilterArgs): Promise<ProjectModel[]> {
    const resolvedFilter = filter?.status ? { status: filter.status } : {};
    return this.projectService.listProjects(resolvedFilter);
  }

  @Query(() => ProjectModel)
  project(@Args('id') id: string): Promise<ProjectModel> {
    return this.projectService.getProject(id);
  }

  @Query(() => ProjectCollectionModel)
  async projectCollection(@Args() filter: ProjectFilterArgs): Promise<ProjectCollectionModel> {
    const resolvedFilter = filter?.status ? { status: filter.status } : {};
    const projects = await this.projectService.listProjects(resolvedFilter);
    return { data: projects };
  }

  @Query(() => TimelineModel)
  projectTimeline(@Args('projectId') projectId: string): Promise<TimelineModel> {
    return this.projectService.getTimeline(projectId);
  }

  @Query(() => ProjectMetricsModel)
  projectMetrics(@Args('projectId') projectId: string): Promise<ProjectMetricsModel> {
    return this.projectService.getMetrics(projectId);
  }

  @Query(() => [ChatThreadModel])
  projectChatThreads(@Args('projectId') projectId: string): Promise<ChatThreadModel[]> {
    return this.projectService.listChatThreads(projectId);
  }

  @Query(() => [ChatSummarySearchModel])
  projectChatSummarySearch(
    @Args('projectId') projectId: string,
    @Args('keyword') keyword: string,
    @Args('top', { nullable: true }) top?: number,
    @Args('minScore', { nullable: true }) minScore?: number,
  ): Promise<ChatSummarySearchModel[]> {
    return this.projectService.searchChatSummaries(projectId, keyword, { top, minScore });
  }

  @Mutation(() => ProjectModel)
  createProject(@Args('input') input: CreateProjectInput): Promise<ProjectModel> {
    return this.projectService.createProject(input);
  }

  @Mutation(() => ChatThreadModel)
  createProjectThread(
    @Args('projectId') projectId: string,
    @Args('input') input: CreateChatThreadInput,
  ): Promise<ChatThreadModel> {
    return this.projectService.createChatThread(projectId, input);
  }
}
