'use client';

import Link from 'next/link';
import type { CkmWorkspaceSummary } from './types';

type Props = {
  workspaces: CkmWorkspaceSummary[];
};

export function CkmWorkspaceList({ workspaces }: Props) {
  if (workspaces.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        CKM ワークスペースがまだありません。`npm run prisma:seed:ckm` でサンプルデータを投入できます。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workspaces.map((workspace) => (
        <Link
          key={workspace.id}
          href={`/ckm/${workspace.code}`}
          className="block rounded border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{workspace.name}</h2>
              <p className="text-sm text-slate-500">コード: {workspace.code}</p>
            </div>
            <span className="rounded bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {workspace.roomCount} ルーム / {workspace.memberCount} メンバー
            </span>
          </div>
          {workspace.description ? (
            <p className="mt-2 text-sm text-slate-600">{workspace.description}</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
