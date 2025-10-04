'use client';

import { FormEvent, useMemo, useState } from "react";
import { apiRequest, graphqlRequest } from "@/lib/api-client";
import { reportClientTelemetry } from "@/lib/telemetry";
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

const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ok
      error
      message
      project {
        id
        code
        name
        clientName
        status
        startOn
        endOn
        manager
        health
        tags
      }
    }
  }
`;

const TRANSITION_PROJECT_MUTATION = `
  mutation TransitionProject($input: ProjectTransitionInput!) {
    projectTransition(input: $input) {
      ok
      error
      message
      project {
        id
        code
        name
        clientName
        status
        startOn
        endOn
        manager
        health
        tags
      }
    }
  }
`;

type ProjectsClientProps = {
  initialProjects: ProjectListResponse;
};

type ProjectItem = ProjectListResponse["items"][number];

type UpdateState = {
  id: string | null;
  message: string | null;
  variant: "success" | "error" | null;
};

type QuerySource = "api" | "mock";

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const initialMeta: NonNullable<ProjectListResponse["meta"]> =
    initialProjects.meta ?? {
      total: initialProjects.items.length,
      fetchedAt: new Date().toISOString(),
      fallback: true,
    };
  const [projects, setProjects] = useState(initialProjects.items);
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>("all");
  const [updateState, setUpdateState] = useState<UpdateState>({ id: null, message: null, variant: null });
  const [pending, setPending] = useState<string | null>(null);
  const [meta, setMeta] = useState(initialMeta);
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    clientName: "",
    manager: "",
    status: "planned" as ProjectStatus,
    health: "green",
  });
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const source: QuerySource = meta.fallback ? "mock" : "api";

  const filteredProjects = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  const normalizeProject = (project: Partial<ProjectItem> | undefined | null): ProjectItem | null => {
    if (!project?.id) return null;
    return {
      id: project.id,
      code: project.code ?? project.id,
      name: project.name ?? project.id,
      clientName: project.clientName ?? undefined,
      status: (project.status as ProjectStatus) ?? "planned",
      startOn: project.startOn ?? undefined,
      endOn: project.endOn ?? undefined,
      manager: project.manager ?? undefined,
      health: (project.health as ProjectItem["health"]) ?? "green",
      tags: Array.isArray(project.tags) ? (project.tags.filter(Boolean) as string[]) : [],
    };
  };

  const applyProjectUpdate = (project: ProjectItem) => {
    setProjects((prev) =>
      prev.map((item) =>
        item.id === project.id
          ? {
              ...item,
              ...project,
            }
          : item,
      ),
    );
    setMeta((prev) => ({
      ...prev,
      fallback: false,
      fetchedAt: new Date().toISOString(),
    }));
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError("プロジェクト名を入力してください");
      return;
    }
    setCreateError(null);
    setCreateMessage(null);
    setCreating(true);
    const input = {
      name: createForm.name.trim(),
      code: createForm.code.trim() || undefined,
      clientName: createForm.clientName.trim() || undefined,
      manager: createForm.manager.trim() || undefined,
      status: createForm.status,
      health: createForm.health,
    };
    try {
      const gql = await graphqlRequest<{
        createProject: { ok: boolean; error?: string | null; message?: string | null; project?: ProjectItem };
      }>({
        query: CREATE_PROJECT_MUTATION,
        variables: { input },
      });
      if (!gql.createProject.ok) {
        throw new Error(gql.createProject.error ?? gql.createProject.message ?? "GraphQL mutation failed");
      }
      const project = normalizeProject(gql.createProject.project);
      if (!project) {
        throw new Error("GraphQL payload missing project");
      }
      setProjects((prev) => [project, ...prev]);
      setMeta((prev) => ({
        ...prev,
        total: prev.total + 1,
        fallback: false,
        fetchedAt: new Date().toISOString(),
      }));
      setCreateMessage(gql.createProject.message ?? "プロジェクトを追加しました");
      setCreateForm({ name: "", code: "", clientName: "", manager: "", status: "planned", health: "green" });
      return;
    } catch (error) {
      console.warn("[projects] graphql create failed, fallback to REST", error);
      reportClientTelemetry({
        component: "projects/client",
        event: "graphql_create_failed",
        level: "warn",
        detail: {
          strategy: "rest",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      try {
        const rest = await apiRequest<{ ok: boolean; item: ProjectItem }>({
          path: "/api/v1/projects",
          method: "POST",
          body: JSON.stringify({
            name: input.name,
            code: input.code,
            clientName: input.clientName,
            manager: input.manager,
            status: input.status,
            health: input.health,
          }),
        });
        if (!rest.ok || !rest.item) {
          throw new Error("REST API response invalid");
        }
        const project = normalizeProject(rest.item);
        if (!project) {
          throw new Error("REST payload missing project");
        }
        setProjects((prev) => [project, ...prev]);
        setMeta((prev) => ({
          ...prev,
          total: prev.total + 1,
          fallback: false,
          fetchedAt: new Date().toISOString(),
        }));
        setCreateMessage("REST API でプロジェクトを追加しました");
        setCreateForm({ name: "", code: "", clientName: "", manager: "", status: "planned", health: "green" });
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_create_succeeded",
          level: "info",
          detail: {
            strategy: "rest",
            projectId: project.id,
          },
        });
      } catch (restError) {
        setCreateError((restError as Error).message ?? "プロジェクト追加に失敗しました");
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_create_failed",
          level: "error",
          detail: {
            strategy: "rest",
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (project: ProjectItem, action: ProjectAction) => {
    setPending(project.id);
    setUpdateState({ id: project.id, message: null, variant: null });
    try {
      const gql = await graphqlRequest<{
        projectTransition: { ok: boolean; error?: string | null; message?: string | null; project?: ProjectItem };
      }>({
        query: TRANSITION_PROJECT_MUTATION,
        variables: { input: { projectId: project.id, action } },
      });
      if (!gql.projectTransition.ok) {
        throw new Error(gql.projectTransition.error ?? gql.projectTransition.message ?? "GraphQL transition failed");
      }
      const updated = normalizeProject(gql.projectTransition.project);
      if (updated) {
        applyProjectUpdate(updated);
      } else {
        applyProjectUpdate({ ...project, status: inferNextStatus(project.status, action) });
      }
      setUpdateState({
        id: project.id,
        message: gql.projectTransition.message ?? `${actionLabel[action]} succeeded`,
        variant: "success",
      });
    } catch (error) {
      console.warn("[projects] graphql transition failed, fallback to REST", error);
      reportClientTelemetry({
        component: "projects/client",
        event: "graphql_transition_failed",
        level: "warn",
        detail: {
          strategy: "rest",
          projectId: project.id,
          action,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      try {
        await apiRequest<unknown>({
          path: `/api/v1/projects/${project.id}/${action}`,
          method: "POST",
        });
        applyProjectUpdate({ ...project, status: inferNextStatus(project.status, action) });
        setUpdateState({
          id: project.id,
          message: `${actionLabel[action]} succeeded (REST fallback)`,
          variant: "success",
        });
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_transition_succeeded",
          level: "info",
          detail: {
            strategy: "rest",
            projectId: project.id,
            action,
          },
        });
      } catch (restError) {
        console.error("project action failed", restError);
        setUpdateState({ id: project.id, message: `Failed to ${actionLabel[action].toLowerCase()}`, variant: "error" });
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_transition_failed",
          level: "error",
          detail: {
            strategy: "rest",
            projectId: project.id,
            action,
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/20">
        <h3 className="text-sm font-semibold text-slate-200">GraphQL: プロジェクト追加</h3>
        <p className="mt-1 text-xs text-slate-400">GraphQL ミューテーションを利用して PoC データを更新するサンプルです。</p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateProject}>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">プロジェクト名 *</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">コード</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.code}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">クライアント</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.clientName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, clientName: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">マネージャ</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.manager}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, manager: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">ステータス</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.status}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}
            >
              {statusFilters
                .filter((item) => item.value !== "all")
                .map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">ヘルス</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={createForm.health}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, health: event.target.value }))}
            >
              <option value="green">green</option>
              <option value="yellow">yellow</option>
              <option value="red">red</option>
            </select>
          </label>
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {createError ? <span className="text-rose-300">{createError}</span> : null}
              {createMessage ? <span className="text-emerald-300">{createMessage}</span> : null}
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {creating ? "送信中..." : "GraphQLで追加"}
            </button>
          </div>
        </form>
      </section>

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

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>
          表示件数: {filteredProjects.length.toLocaleString()} / {meta.total.toLocaleString()} 件
        </span>
        <span>取得時刻: {formatDateTime(meta.fetchedAt)}</span>
        <span
          className={`rounded-full px-2 py-1 font-medium ${
            source === "api" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
          }`}
        >
          {source === "api" ? "API live" : "Mock data"}
        </span>
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

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
