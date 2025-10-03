'use client';

import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { STATUS_LABEL, type ProjectAction, type ProjectListResponse, type ProjectStatus } from "./types";

const statusFilters: Array<{ value: "all" | ProjectStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "planned", label: STATUS_LABEL.planned },
  { value: "active", label: STATUS_LABEL.active },
  { value: "onhold", label: STATUS_LABEL.onhold },
  { value: "closed", label: STATUS_LABEL.closed },
];

const transitions: Record<ProjectStatus, ProjectAction[]> = {
  planned: ["activate", "close"],
  active: ["hold", "close"],
  onhold: ["resume", "close"],
  closed: [],
};

const actionLabel: Record<ProjectAction, string> = {
  activate: "Activate",
  hold: "Hold",
  resume: "Resume",
  close: "Close",
};

const HEALTH_CLASS: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

type ProjectsClientProps = {
  initialProjects: ProjectListResponse;
};

type ProjectItem = ProjectListResponse["items"][number];

type UpdateState = {
  id: string | null;
  message: string | null;
  variant: "success" | "error" | null;
};

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const [projects, setProjects] = useState(initialProjects.items);
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>("all");
  const [updateState, setUpdateState] = useState<UpdateState>({ id: null, message: null, variant: null });
  const [pending, setPending] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  const handleAction = async (project: ProjectItem, action: ProjectAction) => {
    setPending(project.id);
    setUpdateState({ id: project.id, message: null, variant: null });
    try {
      await apiRequest<unknown>({
        path: `/api/v1/projects/${project.id}/${action}`,
        method: "POST",
      });
      const nextStatus = inferNextStatus(project.status, action);
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item,
        ),
      );
      setUpdateState({ id: project.id, message: `${actionLabel[action]} succeeded`, variant: "success" });
    } catch (error) {
      console.error("project action failed", error);
      setUpdateState({ id: project.id, message: `Failed to ${actionLabel[action].toLowerCase()}`, variant: "error" });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === item.value ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredProjects.map((project) => (
          <article key={project.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/50">
            <header className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{project.code}</span>
                  {project.clientName ? <span>• {project.clientName}</span> : null}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-white">{project.name}</h3>
              </div>
              <StatusBadge status={project.status} />
            </header>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                <dt className="uppercase tracking-wide">Start</dt>
                <dd className="text-slate-200">{project.startOn ?? "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">End</dt>
                <dd className="text-slate-200">{project.endOn ?? "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Manager</dt>
                <dd className="text-slate-200">{project.manager ?? "未設定"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Health</dt>
                <dd className="flex items-center gap-2 text-slate-200">
                  <span className={`h-2 w-2 rounded-full ${HEALTH_CLASS[project.health ?? "green"] ?? HEALTH_CLASS.green}`} />
                  {project.health ?? "—"}
                </dd>
              </div>
            </dl>

            {project.tags && project.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1 text-[11px] text-slate-300">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {transitions[project.status].length === 0 ? (
                <span className="text-xs text-slate-500">No further actions</span>
              ) : (
                transitions[project.status].map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={pending === project.id}
                    onClick={() => handleAction(project, action)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      pending === project.id
                        ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500"
                        : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {actionLabel[action]}
                  </button>
                ))
              )}
            </div>

            {updateState.id === project.id && updateState.variant ? (
              <p
                className={`mt-3 text-xs ${
                  updateState.variant === "success" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {updateState.message}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function inferNextStatus(current: ProjectStatus, action: ProjectAction): ProjectStatus {
  switch (action) {
    case "activate":
      return "active";
    case "hold":
      return "onhold";
    case "resume":
      return "active";
    case "close":
      return "closed";
    default:
      return current;
  }
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const color =
    status === "active"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : status === "planned"
        ? "bg-slate-600/20 text-slate-200 border-slate-500/50"
        : status === "onhold"
          ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
          : "bg-rose-500/20 text-rose-200 border-rose-500/40";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${color}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
