import { ProjectsClient } from "@/features/projects/ProjectsClient";
import { mockProjects } from "@/features/projects/mock-data";
import type { ProjectListResponse } from "@/features/projects/types";

const defaultMeta: NonNullable<ProjectListResponse["meta"]> = {
  total: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
};

async function fetchProjects(): Promise<ProjectListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/v1/projects`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const data = (await res.json()) as Partial<ProjectListResponse>;
    return {
      items: data.items ?? [],
      meta: {
        total: data.meta?.total ?? data.items?.length ?? 0,
        fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
        fallback: data.meta?.fallback ?? false,
      },
    } satisfies ProjectListResponse;
  } catch (error) {
    console.warn("[projects] falling back to mock data due to fetch error", error);
    return {
      ...mockProjects,
      meta: {
        ...defaultMeta,
        ...mockProjects.meta,
      },
    };
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
