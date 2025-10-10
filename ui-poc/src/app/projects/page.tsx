import { ProjectsClient } from "@/features/projects/ProjectsClient";
import { PROJECTS_PAGE_SIZE } from "@/features/projects/constants";
import { mockProjects } from "@/features/projects/mock-data";
import { PROJECTS_PAGE_QUERY } from "@/features/projects/queries";
import type { ProjectListResponse } from "@/features/projects/types";
import { graphqlRequest } from "@/lib/api-client.server";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: NonNullable<ProjectListResponse["meta"]> = {
  total: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
  returned: 0,
};

const ALLOWED_STATUS = new Set(["all", "planned", "active", "onhold", "closed"]);

type ProjectFetchParams = {
  status?: string | null;
  keyword?: string | null;
  manager?: string | null;
  tag?: string | null;
  health?: string | null;
};

async function fetchProjects({ status, keyword, manager, tag, health }: ProjectFetchParams = {}): Promise<ProjectListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  const normalizedStatus = typeof status === "string" && ALLOWED_STATUS.has(status) ? status : "all";
  const normalizedKeyword = typeof keyword === "string" && keyword.trim().length > 0 ? keyword.trim() : undefined;
  const normalizedManager = typeof manager === "string" && manager.trim().length > 0 ? manager.trim() : undefined;
  const normalizedTag = typeof tag === "string" && tag.trim().length > 0 ? tag.trim() : undefined;
  const normalizedHealth = typeof health === "string" && ["green", "yellow", "red"].includes(health.trim()) ? health.trim() : undefined;
  try {
    const gql = await graphqlRequest<{
      projects?: { items?: ProjectListResponse["items"]; meta?: ProjectListResponse["meta"]; pageInfo?: ProjectListResponse["pageInfo"] };
    }>({
      query: PROJECTS_PAGE_QUERY,
      variables: {
        status: normalizedStatus,
        keyword: normalizedKeyword,
        manager: normalizedManager,
        tag: normalizedTag,
        health: normalizedHealth,
        first: PROJECTS_PAGE_SIZE,
      },
      baseUrl: base,
    });
    const items = Array.isArray(gql.projects?.items) ? gql.projects.items : [];
    const meta = gql.projects?.meta ?? { total: items.length, fetchedAt: new Date().toISOString(), fallback: false, returned: items.length };
    const pageInfo = gql.projects?.pageInfo ?? { endCursor: null, hasNextPage: false };
    return {
      items,
      meta,
      pageInfo,
      next_cursor: pageInfo.hasNextPage ? pageInfo.endCursor ?? undefined : undefined,
    } satisfies ProjectListResponse;
  } catch (error) {
    console.warn("[projects] GraphQL fetch failed, fallback to REST", error);
    await reportServerTelemetry({
      component: "projects/page",
      event: "graphql_fetch_failed",
      level: "warn",
      detail: {
        stage: "initial",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    try {
      const url = new URL("/api/v1/projects", base);
      if (normalizedStatus && normalizedStatus !== "all") {
        url.searchParams.set("status", normalizedStatus);
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as Partial<ProjectListResponse>;
      await reportServerTelemetry({
        component: "projects/page",
        event: "rest_fallback_succeeded",
        level: "info",
        detail: {
          stage: "initial",
          items: data.items?.length ?? 0,
        },
      });
      const filteredItems = (data.items ?? []).filter((project) => {
        if (normalizedHealth && project.health !== normalizedHealth) {
          return false;
        }
        if (normalizedManager) {
          const managerValue = (project.manager ?? "").toString().toLowerCase();
          if (!managerValue.includes(normalizedManager.toLowerCase())) {
            return false;
          }
        }
        if (normalizedTag) {
          const tags = Array.isArray(project.tags) ? project.tags.map((value) => value?.toString().toLowerCase()) : [];
          if (!tags.includes(normalizedTag.toLowerCase())) {
            return false;
          }
        }
        if (normalizedKeyword) {
          const haystack = `${project.name ?? ""} ${project.code ?? ""} ${project.clientName ?? ""}`.toLowerCase();
          if (!haystack.includes(normalizedKeyword.toLowerCase())) {
            return false;
          }
        }
        return true;
      });
      const limitedItems = filteredItems.slice(0, PROJECTS_PAGE_SIZE);
      const endCursor = limitedItems.length > 0 ? limitedItems[limitedItems.length - 1]?.id ?? null : null;
      return {
        items: limitedItems,
        meta: {
          total: filteredItems.length,
          fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
          fallback: data.meta?.fallback ?? false,
          returned: limitedItems.length,
        },
        pageInfo: {
          endCursor,
          hasNextPage: limitedItems.length < filteredItems.length,
        },
        next_cursor: limitedItems.length < filteredItems.length ? endCursor ?? undefined : undefined,
      } satisfies ProjectListResponse;
    } catch (restError) {
      console.warn("[projects] falling back to mock data", restError);
      await reportServerTelemetry({
        component: "projects/page",
        event: "mock_fallback",
        level: "warn",
        detail: {
          stage: "initial",
          error: restError instanceof Error ? restError.message : String(restError),
        },
      });
      const limitedMockItems = mockProjects.items.slice(0, PROJECTS_PAGE_SIZE);
      const mockTotal = mockProjects.meta?.total ?? mockProjects.items.length;
      const mockEndCursor = limitedMockItems.length > 0 ? limitedMockItems[limitedMockItems.length - 1]?.id ?? null : null;
      return {
        items: limitedMockItems,
        meta: {
          ...defaultMeta,
          ...mockProjects.meta,
          total: mockTotal,
          returned: limitedMockItems.length,
        },
        pageInfo: {
          endCursor: mockEndCursor,
          hasNextPage: limitedMockItems.length < mockTotal,
        },
        next_cursor: limitedMockItems.length < mockTotal ? mockEndCursor ?? undefined : undefined,
      };
    }
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const statusParam = typeof searchParams?.status === "string" ? searchParams.status : Array.isArray(searchParams?.status) ? searchParams?.status[0] ?? null : null;
  const keywordParam = typeof searchParams?.keyword === "string"
    ? searchParams.keyword
    : Array.isArray(searchParams?.keyword)
      ? searchParams.keyword[0] ?? null
      : null;
  const managerParam = typeof searchParams?.manager === "string"
    ? searchParams.manager
    : Array.isArray(searchParams?.manager)
      ? searchParams.manager[0] ?? null
      : null;
  const tagParam = typeof searchParams?.tag === "string"
    ? searchParams.tag
    : Array.isArray(searchParams?.tag)
      ? searchParams.tag[0] ?? null
      : null;
  const healthParam = typeof searchParams?.health === "string"
    ? searchParams.health
    : Array.isArray(searchParams?.health)
      ? searchParams.health[0] ?? null
      : null;

  const data = await fetchProjects({ status: statusParam, keyword: keywordParam, manager: managerParam, tag: tagParam, health: healthParam });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Projects PoC</h2>
        <p className="text-sm text-slate-400">
          プロジェクトポートフォリオのUXを検討するための画面です。現時点ではモックデータを表示し、
          状態遷移の操作感やカードレイアウトの方向性を確認できます。Podman バックエンドを起動した
          状態では <code>/api/v1/projects</code> を通じて PoC データが表示されます。
        </p>
      </header>

      <ProjectsClient initialProjects={data} />
    </section>
  );
}
