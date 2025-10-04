import { ProjectsClient } from "@/features/projects/ProjectsClient";
import { mockProjects } from "@/features/projects/mock-data";
import type { ProjectListResponse } from "@/features/projects/types";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: NonNullable<ProjectListResponse["meta"]> = {
  total: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
};

const PROJECTS_QUERY = `
  query ProjectsPage($status: String) {
    projects(status: $status) {
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
`;

async function fetchProjects(): Promise<ProjectListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  try {
    const gql = await fetch(`${base}/graphql`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: PROJECTS_QUERY, variables: { status: "all" } }),
    });
    if (!gql.ok) {
      throw new Error(`graphql status ${gql.status}`);
    }
    const payload = (await gql.json()) as {
      data?: { projects?: ProjectListResponse["items"] };
      errors?: Array<{ message: string }>;
    };
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((err) => err.message).join("; "));
    }
    const items = Array.isArray(payload.data?.projects) ? payload.data?.projects ?? [] : [];
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
      const res = await fetch(`${base}/api/v1/projects`, { cache: "no-store" });
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

export default async function ProjectsPage() {
  const data = await fetchProjects();

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
