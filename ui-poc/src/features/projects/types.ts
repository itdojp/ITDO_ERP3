export type ProjectStatus = "planned" | "active" | "onhold" | "closed";

export type ProjectSummary = {
  id: string;
  code: string;
  name: string;
  clientName?: string;
  status: ProjectStatus;
  startOn?: string;
  endOn?: string;
  health?: "green" | "yellow" | "red";
  manager?: string;
  tags?: string[];
};

export type ProjectListResponse = {
  items: ProjectSummary[];
  meta?: {
    total: number;
    fetchedAt: string;
    fallback: boolean;
    returned?: number;
  };
  next_cursor?: string;
  pageInfo?: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

export type ProjectAction = "activate" | "hold" | "resume" | "close";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  onhold: "On Hold",
  closed: "Closed",
};

export type TimelineTask = {
  id: string;
  name: string;
  phase?: string;
  startDate: string;
  endDate: string;
  status: "todo" | "inProgress" | "review" | "done" | "blocked";
};

export type TimelinePhase = {
  id: string;
  name: string;
  sortOrder: number;
};

export type EvmSnapshot = {
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  scheduleVariance: number;
  cpi: number;
  spi: number;
};

export type BurndownSeries = {
  labels: string[];
  planned: number[];
  actual: number[];
};

export type RiskSummary = {
  id: string;
  probability: number;
  impact: number;
  status: string;
};

export type ProjectTimeline = {
  projectId: string;
  metrics: EvmSnapshot;
  tasks: TimelineTask[];
  phases: TimelinePhase[];
  chatSummary?: string;
  chatSummaryLanguage?: string;
};

export type ProjectMetrics = {
  projectId: string;
  evm: EvmSnapshot;
  burndown: BurndownSeries;
  risks: RiskSummary[];
};

export type ProjectInsights = {
  timeline: ProjectTimeline;
  metrics: ProjectMetrics;
};
