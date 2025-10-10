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
