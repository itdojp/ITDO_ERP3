import Link from 'next/link';
import { CkmWorkspaceList } from '@/features/ckm/CkmWorkspaceList';
import { listCkmWorkspaces } from '@/features/ckm/api';

export const dynamic = 'force-dynamic';

export default async function CkmWorkspacesPage() {
  const workspaces = await listCkmWorkspaces();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">CKM ワークスペース</h1>
          <p className="mt-2 text-sm text-slate-600">
            docker compose と `npm run prisma:seed:ckm` を利用するとサンプルデータを起動できます。
          </p>
        </div>
        <Link
          href="/projects"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          プロジェクト一覧へ戻る
        </Link>
      </div>

      <CkmWorkspaceList workspaces={workspaces} />
    </div>
  );
}
