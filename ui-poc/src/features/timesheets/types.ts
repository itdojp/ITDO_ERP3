export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export type TimesheetEntry = {
  id: string;
  userName: string;
  projectCode: string;
  projectName: string;
  taskName?: string;
  workDate: string;
  hours: number;
  approvalStatus: TimesheetStatus;
  note?: string;
  submittedAt?: string;
};

export type TimesheetListMeta = {
  total: number;
  returned: number;
  fetchedAt: string;
  fallback: boolean;
  status?: TimesheetStatus | 'all';
};

export type TimesheetListResponse = {
  items: TimesheetEntry[];
  meta?: TimesheetListMeta;
  next_cursor?: string;
};

export type TimesheetAction = "submit" | "approve" | "reject" | "resubmit";

export type ActionPayload = {
  comment?: string;
  reasonCode?: string;
};

export const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const ACTION_LABEL: Record<TimesheetAction, string> = {
  submit: "Submit",
  approve: "Approve",
  reject: "Reject",
  resubmit: "Resubmit",
};
