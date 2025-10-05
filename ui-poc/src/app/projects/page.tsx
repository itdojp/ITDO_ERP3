import { ProjectsClient } from "@/features/projects/ProjectsClient";
import { mockProjects } from "@/features/projects/mock-data";
import { PROJECTS_PAGE_QUERY } from "@/features/projects/queries";
import type { ProjectListResponse } from "@/features/projects/types";
import { graphqlRequest } from "@/lib/api-client.server";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: NonNullable<ProjectListResponse["meta"]> = {
  total: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
};

const ALLOWED_STATUS = new Set(["all", "planned", "active", "onhold", "closed"]);

type ProjectFetchParams = {
  status?: string | null;
  keyword?: string | null;
};

async function fetchProjects({ status, keyword }: ProjectFetchParams = {}): Promise<ProjectListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  const normalizedStatus = typeof status === "string" && ALLOWED_STATUS.has(status) ? status : "all";
  const normalizedKeyword = typeof keyword === "string" && keyword.trim().length > 0 ? keyword.trim() : undefined;
  try {
    const gql = await graphqlRequest<{
      projects?: ProjectListResponse["items"];
    }>({
      query: PROJECTS_PAGE_QUERY,
      variables: { status: normalizedStatus, keyword: normalizedKeyword },
      baseUrl: base,
    });
    const items = Array.isArray(gql.projects) ? gql.projects : [];
    return {
      items,
      meta: {
        total: items.length,
        fetchedAt: new Date().toISOString(),
        fallback: false,
      },
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
      return {
        items: data.items ?? [],
        meta: {
          total: data.meta?.total ?? data.items?.length ?? 0,
          fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
          fallback: data.meta?.fallback ?? false,
        },
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
      return {
        ...mockProjects,
        meta: {
          ...defaultMeta,
          ...mockProjects.meta,
        },
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

  const data = await fetchProjects({ status: statusParam, keyword: keywordParam });

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
