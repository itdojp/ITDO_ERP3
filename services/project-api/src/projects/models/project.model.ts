import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum ProjectStatus {
  Draft = 'draft',
  Active = 'active',
  OnHold = 'onHold',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum TaskStatus {
  Todo = 'todo',
  InProgress = 'inProgress',
  Review = 'review',
  Done = 'done',
  Blocked = 'blocked',
}

export enum ChatProvider {
  Slack = 'Slack',
  Teams = 'Teams',
}

registerEnumType(ProjectStatus, { name: 'ProjectStatus' });
registerEnumType(TaskStatus, { name: 'TaskStatus' });
registerEnumType(ChatProvider, { name: 'ChatProvider' });

@ObjectType()
export class EvmModel {
  @Field(() => Float)
  plannedValue!: number;

  @Field(() => Float)
  earnedValue!: number;

  @Field(() => Float)
  actualCost!: number;

  @Field(() => Float)
  costVariance!: number;

  @Field(() => Float)
  scheduleVariance!: number;

  @Field(() => Float)
  cpi!: number;

  @Field(() => Float)
  spi!: number;
}

@ObjectType()
export class BurndownSeriesModel {
  @Field(() => [String])
  labels!: string[];

  @Field(() => [Float])
  planned!: number[];

  @Field(() => [Float])
  actual!: number[];
}

@ObjectType()
export class RiskSummaryModel {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  probability!: number;

  @Field(() => Int)
  impact!: number;

  @Field(() => String)
  status!: string;
}

@ObjectType()
export class ChatThreadModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ChatProvider)
  provider!: ChatProvider;

  @Field()
  externalThreadId!: string;

  @Field({ nullable: true })
  channelName?: string;

  @Field(() => [Float])
  summaryEmbedding!: number[];
}

@ObjectType()
export class TimelineTaskModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  startDate!: string;

  @Field()
  endDate!: string;

  @Field(() => TaskStatus)
  status!: TaskStatus;
}

@ObjectType()
export class TimelineModel {
  @Field(() => ID)
  projectId!: string;

  @Field(() => [TimelineTaskModel])
  tasks!: TimelineTaskModel[];

  @Field(() => EvmModel)
  metrics!: EvmModel;

  @Field({ nullable: true })
  chatSummary?: string;
}

@ObjectType()
export class ProjectMetricsModel {
  @Field(() => ID)
  projectId!: string;

  @Field(() => EvmModel)
  evm!: EvmModel;

  @Field(() => BurndownSeriesModel)
  burndown!: BurndownSeriesModel;

  @Field(() => [RiskSummaryModel])
  risks!: RiskSummaryModel[];
}

@ObjectType()
export class ProjectModel {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ProjectStatus)
  status!: ProjectStatus;

  @Field()
  startDate!: string;

  @Field({ nullable: true })
  endDate?: string;

  @Field(() => EvmModel)
  evm!: EvmModel;
}

@ObjectType()
export class ProjectCollectionModel {
  @Field(() => [ProjectModel])
  data!: ProjectModel[];
}
