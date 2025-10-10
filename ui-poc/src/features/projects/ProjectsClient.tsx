'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, graphqlRequest } from "@/lib/api-client";
import { reportClientTelemetry } from "@/lib/telemetry";
import { STATUS_LABEL, type ProjectAction, type ProjectListResponse, type ProjectStatus } from "./types";
import { mockProjects } from "./mock-data";
import { CREATE_PROJECT_MUTATION, PROJECTS_PAGE_QUERY, PROJECT_TRANSITION_MUTATION } from "./queries";

const statusFilters: Array<{ value: "all" | ProjectStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "planned", label: STATUS_LABEL.planned },
  { value: "active", label: STATUS_LABEL.active },
  { value: "onhold", label: STATUS_LABEL.onhold },
  { value: "closed", label: STATUS_LABEL.closed },
];

const popularTags = ["DX", "Compliance", "Risk", "Priority", "SAP", "AMS"] as const;

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

const STORAGE_KEY = "projects-filters-v1";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
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

  const router = useRouter();
  const pathname = usePathname();
  const hydratedRef = useRef(false);
  const lastSyncedQueryRef = useRef<string | null>(null);
  const filterRef = useRef(filter);
  const keywordRef = useRef(appliedKeyword);
  const managerRef = useRef("");
  const tagRef = useRef("");
  const selectedTagsRef = useRef<string[]>([]);
  const healthRef = useRef<"" | ProjectItem["health"]>("" as "" | ProjectItem["health"]);

  const [managerTerm, setManagerTerm] = useState("");
  const [appliedManager, setAppliedManager] = useState("");
  const [tagTerm, setTagTerm] = useState("");
  const [appliedTag, setAppliedTag] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [appliedSelectedTags, setAppliedSelectedTags] = useState<string[]>([]);
  const [healthFilter, setHealthFilter] = useState<"" | ProjectItem["health"]>("");
  const [appliedHealth, setAppliedHealth] = useState<"" | ProjectItem["health"]>("");

  const toggleTagSelection = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((value) => value !== tag);
      }
      return [...prev, tag];
    });
  }, []);

  const tagFiltersLower = useMemo(() => {
    const manual = appliedTag.trim().toLowerCase();
    const selected = appliedSelectedTags.map((value) => value.toLowerCase());
    const combined = manual ? [manual, ...selected] : selected;
    return combined.filter((value, index, array) => value && array.indexOf(value) === index);
  }, [appliedTag, appliedSelectedTags]);

  const filteredProjects = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    const manager = appliedManager.trim().toLowerCase();
    const health = appliedHealth;
    return projects.filter((project) => {
      const statusMatch = filter === "all" || project.status === filter;
      if (!statusMatch) return false;
      if (health && project.health !== health) {
        return false;
      }
      if (manager) {
        const managerName = (project.manager ?? '').toLowerCase();
        if (!managerName.includes(manager)) {
          return false;
        }
      }
      if (tagFiltersLower.length > 0) {
        const tagList = Array.isArray(project.tags)
          ? project.tags.filter(Boolean).map((value) => value.toLowerCase())
          : [];
        const hasMatch = tagFiltersLower.some((value) => tagList.includes(value));
        if (!hasMatch) {
          return false;
        }
      }
      if (!keyword) return true;
      const haystack = `${project.name} ${project.code ?? ""} ${project.clientName ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [projects, filter, appliedKeyword, appliedManager, appliedHealth, tagFiltersLower]);

  const normalizeProject = useCallback((project: Partial<ProjectItem> | undefined | null): ProjectItem | null => {
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
  }, []);

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

  const fetchProjects = useCallback(
    async (
      statusValue: ProjectStatus | "all",
      keywordValue: string,
      options: { manager?: string; health?: string; tag?: string; tags?: string[] } = {},
    ) => {
      const trimmedKeyword = keywordValue.trim();
      const managerValue = options.manager?.trim() ?? '';
      const healthValue = options.health?.trim() ?? '';
      const manualTagRaw = options.tag?.trim() ?? '';
      const manualTag = manualTagRaw.toLowerCase();
      const selectedTagsRaw = Array.isArray(options.tags)
        ? options.tags.map((value) => value.trim()).filter(Boolean)
        : [];
      const selectedTagsLower = selectedTagsRaw.map((value) => value.toLowerCase());
      const primaryTag = manualTagRaw || selectedTagsRaw[0] || '';
      fetchTokenRef.current += 1;
      const token = fetchTokenRef.current;
      setListLoading(true);
      setListError(null);

      const assignProjects = (items: ProjectItem[], fallback: boolean) => {
        if (token !== fetchTokenRef.current) {
          return;
        }
        setProjects(items);
        setMeta({
          total: items.length,
          fetchedAt: new Date().toISOString(),
          fallback,
        });
      };

      const finishLoading = () => {
        if (token === fetchTokenRef.current) {
          setListLoading(false);
        }
      };

      const matchesTagFilters = (project: ProjectItem) => {
        const tagList = Array.isArray(project.tags)
          ? project.tags.filter(Boolean).map((value) => value.toLowerCase())
          : [];
        if (manualTag && !tagList.includes(manualTag)) {
          return false;
        }
        if (selectedTagsLower.length > 0) {
          const hasMatch = selectedTagsLower.some((value) => tagList.includes(value));
          if (!hasMatch) {
            return false;
          }
        }
        return true;
      };

      try {
        const gql = await graphqlRequest<{
          projects?: Partial<ProjectItem>[];
        }>({
          query: PROJECTS_PAGE_QUERY,
          variables: {
            status: statusValue,
            keyword: trimmedKeyword.length > 0 ? trimmedKeyword : undefined,
            manager: managerValue.length > 0 ? managerValue : undefined,
            health: healthValue.length > 0 ? healthValue : undefined,
            tag: primaryTag.length > 0 ? primaryTag : undefined,
          },
        });

        const items = Array.isArray(gql.projects) ? gql.projects : [];
        const normalized = items
          .map((item) => normalizeProject(item))
          .filter(Boolean) as ProjectItem[];
        const filtered = normalized.filter(matchesTagFilters);
        assignProjects(filtered, false);
        finishLoading();
        return;
      } catch (error) {
        console.warn("[projects] graphql list failed, fallback to REST", error);
        reportClientTelemetry({
          component: "projects/client",
          event: "graphql_list_failed",
          level: "warn",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
            tag: manualTagRaw,
            tags: selectedTagsRaw,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      try {
        const params = new URLSearchParams();
        if (statusValue !== "all") {
          params.set("status", statusValue);
        }
        const path = `/api/v1/projects${params.toString() ? `?${params.toString()}` : ""}`;
        const rest = await apiRequest<ProjectListResponse>({ path });
        const items = Array.isArray(rest.items) ? rest.items : [];
        const normalized = items
          .map((item) => normalizeProject(item))
          .filter(Boolean) as ProjectItem[];
        const filtered = normalized.filter((project) => {
          if (healthValue && project.health !== healthValue) {
            return false;
          }
          if (managerValue) {
            const managerName = (project.manager ?? '').toLowerCase();
            if (!managerName.includes(managerValue.toLowerCase())) {
              return false;
            }
          }
          if (!matchesTagFilters(project)) {
            return false;
          }
          if (trimmedKeyword.length > 0) {
            const haystack = `${project.name} ${project.code ?? ''} ${project.clientName ?? ''}`.toLowerCase();
            if (!haystack.includes(trimmedKeyword.toLowerCase())) {
              return false;
            }
          }
          return true;
        });
        assignProjects(filtered, rest.meta?.fallback ?? false);
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_list_fallback",
          level: "info",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
            tag: manualTagRaw,
            tags: selectedTagsRaw,
          },
        });
        finishLoading();
        return;
      } catch (restError) {
        console.error("[projects] REST fallback failed, using mock", restError);
        reportClientTelemetry({
          component: "projects/client",
          event: "rest_list_failed",
          level: "error",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
            tag: manualTagRaw,
            tags: selectedTagsRaw,
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
        setListError("API から取得できなかったためモックデータを表示しています");
        const fallbackItems = (mockProjects.items ?? [])
          .map((item) => normalizeProject(item))
          .filter(Boolean) as ProjectItem[];
        const filteredFallback = fallbackItems.filter((project) => {
          if (healthValue && project.health !== healthValue) {
            return false;
          }
          if (managerValue) {
            const managerName = (project.manager ?? '').toLowerCase();
            if (!managerName.includes(managerValue.toLowerCase())) {
              return false;
            }
          }
          if (!matchesTagFilters(project)) {
            return false;
          }
          if (trimmedKeyword.length > 0) {
            const haystack = `${project.name} ${project.code ?? ''} ${project.clientName ?? ''}`.toLowerCase();
            return haystack.includes(trimmedKeyword.toLowerCase());
          }
          return true;
        });
        assignProjects(filteredFallback, true);
        finishLoading();
      }
    },
    [normalizeProject],
  );

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    keywordRef.current = appliedKeyword;
  }, [appliedKeyword]);

  useEffect(() => {
    managerRef.current = appliedManager;
  }, [appliedManager]);

  useEffect(() => {
    tagRef.current = appliedTag;
  }, [appliedTag]);

  useEffect(() => {
    selectedTagsRef.current = appliedSelectedTags;
  }, [appliedSelectedTags]);

  useEffect(() => {
    healthRef.current = appliedHealth;
  }, [appliedHealth]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            status: filter,
            keyword: appliedKeyword,
            manager: appliedManager,
            tag: appliedTag,
            tags: appliedSelectedTags,
            health: appliedHealth ?? "",
          }),
        );
      } catch (error) {
        console.warn("[projects] failed to persist filters", error);
      }
    }

    const desiredStatusParam = filter === "all" ? null : filter;
    const desiredKeywordParam = appliedKeyword.trim();
    const nextParams = new URLSearchParams();
    if (desiredStatusParam) {
      nextParams.set("status", desiredStatusParam);
    }
    if (desiredKeywordParam.length > 0) {
      nextParams.set("keyword", desiredKeywordParam);
    }
    const desiredManagerParam = appliedManager.trim();
    const desiredTagParam = appliedTag.trim();
    const desiredHealthParam = appliedHealth?.trim?.() ?? "";
    const desiredTagsParam = appliedSelectedTags.filter((value) => value.trim().length > 0);
    if (desiredManagerParam.length > 0) {
      nextParams.set("manager", desiredManagerParam);
    }
    if (desiredTagParam.length > 0) {
      nextParams.set("tag", desiredTagParam);
    }
    if (desiredTagsParam.length > 0) {
      nextParams.set("tags", desiredTagsParam.join(","));
    }
    if (desiredHealthParam.length > 0) {
      nextParams.set("health", desiredHealthParam);
    }
    const nextQuery = nextParams.toString();

    if (lastSyncedQueryRef.current === nextQuery) {
      return;
    }

    lastSyncedQueryRef.current = nextQuery;
    const target = nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;
    try {
      router.replace(target, { scroll: false });
    } catch (error) {
      console.warn("[projects] router.replace failed", error);
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", target);
    }
  }, [filter, appliedKeyword, appliedManager, appliedTag, appliedHealth, appliedSelectedTags, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizeTagLabel = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const popularMatch = popularTags.find((item) => item.toLowerCase() === trimmed.toLowerCase());
      return popularMatch ?? trimmed;
    };

    const isSameSelection = (next: string[], prev: string[]) =>
      next.length === prev.length && next.every((value, index) => value === prev[index]);

    const parseFiltersFromLocation = () => {
      let stored: { status?: string; keyword?: string; manager?: string; tag?: string; tags?: string[]; health?: string } | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          stored = JSON.parse(raw);
        }
      } catch (error) {
        console.warn("[projects] failed to parse stored filters", error);
      }

      const params = new URLSearchParams(window.location.search);
      const statusFromQuery = params.get("status");
      const keywordFromQuery = params.get("keyword");
      const managerFromQuery = params.get("manager");
      const tagFromQuery = params.get("tag");
      const healthFromQuery = params.get("health");
      const tagsFromQuery = params.get("tags");

      let normalizedStatus: (typeof statusFilters)[number]["value"] = "all";
      if (statusFromQuery && statusFilters.some((item) => item.value === statusFromQuery)) {
        normalizedStatus = statusFromQuery as (typeof statusFilters)[number]["value"];
      } else if (stored?.status && statusFilters.some((item) => item.value === stored.status)) {
        normalizedStatus = stored.status as (typeof statusFilters)[number]["value"];
      }

      let normalizedKeyword = "";
      if (typeof keywordFromQuery === "string" && keywordFromQuery.trim().length > 0) {
        normalizedKeyword = keywordFromQuery.trim();
      } else if (typeof stored?.keyword === "string") {
        normalizedKeyword = stored.keyword;
      }

      let normalizedManager = "";
      if (typeof managerFromQuery === "string" && managerFromQuery.trim().length > 0) {
        normalizedManager = managerFromQuery.trim();
      } else if (typeof stored?.manager === "string") {
        normalizedManager = stored.manager;
      }

      let normalizedTag = "";
      if (typeof tagFromQuery === "string" && tagFromQuery.trim().length > 0) {
        normalizedTag = normalizeTagLabel(tagFromQuery);
      } else if (typeof stored?.tag === "string") {
        normalizedTag = normalizeTagLabel(stored.tag);
      }

      let normalizedSelectedTags: string[] = [];
      if (typeof tagsFromQuery === "string" && tagsFromQuery.trim().length > 0) {
        normalizedSelectedTags = tagsFromQuery
          .split(",")
          .map((value) => normalizeTagLabel(value))
          .filter(Boolean);
      } else if (Array.isArray(stored?.tags)) {
        normalizedSelectedTags = stored.tags
          .map((value) => normalizeTagLabel(String(value)))
          .filter(Boolean);
      }
      normalizedSelectedTags = normalizedSelectedTags.filter((value, index, array) => array.indexOf(value) === index);

      let normalizedHealth: "" | ProjectItem["health"] = "";
      const healthCandidate = (healthFromQuery ?? stored?.health ?? "").trim();
      if (["green", "yellow", "red"].includes(healthCandidate)) {
        normalizedHealth = healthCandidate as ProjectItem["health"];
      }

      if (!hydratedRef.current) {
        setFilter(normalizedStatus);
        setAppliedKeyword(normalizedKeyword);
        setSearchTerm(normalizedKeyword);
        setAppliedManager(normalizedManager);
        setManagerTerm(normalizedManager);
        setAppliedTag(normalizedTag);
        setTagTerm(normalizedTag);
        setAppliedSelectedTags(normalizedSelectedTags);
        setSelectedTags(normalizedSelectedTags);
        setAppliedHealth(normalizedHealth);
        setHealthFilter(normalizedHealth);
        hydratedRef.current = true;
      } else {
        if (normalizedStatus !== filterRef.current) {
          setFilter(normalizedStatus);
        }
        if (normalizedKeyword !== keywordRef.current) {
          setAppliedKeyword(normalizedKeyword);
          setSearchTerm(normalizedKeyword);
        }
        if (normalizedManager !== managerRef.current) {
          setAppliedManager(normalizedManager);
          setManagerTerm(normalizedManager);
        }
        if (normalizedTag !== tagRef.current) {
          setAppliedTag(normalizedTag);
          setTagTerm(normalizedTag);
        }
        if (!isSameSelection(normalizedSelectedTags, selectedTagsRef.current)) {
          setAppliedSelectedTags(normalizedSelectedTags);
          setSelectedTags(normalizedSelectedTags);
        }
        if (normalizedHealth !== healthRef.current) {
          setAppliedHealth(normalizedHealth);
          setHealthFilter(normalizedHealth);
        }
      }

      lastSyncedQueryRef.current = params.toString();
    };

    parseFiltersFromLocation();

    const handlePopState = () => {
      parseFiltersFromLocation();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    void fetchProjects(filter, appliedKeyword, {
      manager: appliedManager,
      health: appliedHealth || undefined,
      tag: appliedTag,
      tags: appliedSelectedTags,
    });
  }, [fetchProjects, filter, appliedKeyword, appliedManager, appliedHealth, appliedTag, appliedSelectedTags]);

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
      void fetchProjects(filter, appliedKeyword, {
        manager: appliedManager,
        health: appliedHealth || undefined,
        tag: appliedTag,
      });
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
        void fetchProjects(filter, appliedKeyword, {
          manager: appliedManager,
          health: appliedHealth || undefined,
          tag: appliedTag,
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
        query: PROJECT_TRANSITION_MUTATION,
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

      <form
        className="grid gap-3 md:grid-cols-4 items-end"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setAppliedKeyword(searchTerm.trim());
          setAppliedManager(managerTerm.trim());
          setAppliedTag(tagTerm.trim());
          setAppliedSelectedTags(selectedTags.map((value) => value.trim()).filter((value) => value.length > 0));
          setAppliedHealth(healthFilter);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>キーワード検索</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="名前・コード・顧客名で検索"
            data-testid="projects-search-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>マネージャ</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={managerTerm}
            onChange={(event) => setManagerTerm(event.target.value)}
            placeholder="例: 山田"
            data-testid="projects-filter-manager"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>タグ</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={tagTerm}
            onChange={(event) => setTagTerm(event.target.value)}
            placeholder="例: dx"
            data-testid="projects-filter-tag"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>ヘルス</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={healthFilter}
            onChange={(event) => {
              const value = event.target.value as ProjectItem["health"];
              setHealthFilter(value ? value : "");
            }}
            data-testid="projects-filter-health"
          >
            <option value="">指定なし</option>
            <option value="green">green</option>
            <option value="yellow">yellow</option>
            <option value="red">red</option>
          </select>
        </label>
        <div className="md:col-span-4">
          <span className="mb-1 block text-xs text-slate-400">主要タグ</span>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => {
              const checked = selectedTags.includes(tag);
              return (
                <label
                  key={tag}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                    checked
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-sky-500"
                    checked={checked}
                    onChange={() => toggleTagSelection(tag)}
                    data-testid={`projects-filter-tag-${tag.toLowerCase()}`}
                  />
                  <span>{tag}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading}
          >
            検索
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setManagerTerm("");
              setTagTerm("");
              setHealthFilter("");
              setSelectedTags([]);
              setAppliedKeyword("");
              setAppliedManager("");
              setAppliedTag("");
              setAppliedSelectedTags([]);
              setAppliedHealth("");
            }}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading}
          >
            クリア
          </button>
        </div>
      </form>

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
        {listLoading ? <span className="text-sky-300">読み込み中...</span> : null}
        {listError ? <span className="text-amber-300">{listError}</span> : null}
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
