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
  next_cursor?: string;
};

export type ProjectAction = "activate" | "hold" | "resume" | "close";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  onhold: "On Hold",
  closed: "Closed",
};
