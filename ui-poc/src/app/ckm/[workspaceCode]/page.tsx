import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCkmWorkspaceDetail } from '@/features/ckm/api';

export const dynamic = 'force-dynamic';

type Params = Promise<{ workspaceCode: string }>;

type Props = {
  params: Params;
};

export default async function CkmWorkspaceDetailPage({ params }: Props) {
  const { workspaceCode } = await params;
  let workspace;
  try {
    workspace = await getCkmWorkspaceDetail(workspaceCode);
  } catch (error) {
    console.warn('[ckm] workspace fetch failed', error);
    return notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{workspace.name}</h1>
        <p className="mt-1 text-sm text-slate-600">コード: {workspace.code}</p>
        {workspace.description ? <p className="mt-2 text-sm text-slate-600">{workspace.description}</p> : null}
        <p className="mt-2 text-xs text-slate-500">
          {workspace.roomCount} ルーム / {workspace.memberCount} メンバー
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">ルーム一覧</h2>
        <Link href="/ckm" className="text-sm font-medium text-blue-600 hover:text-blue-500">
          ワークスペース一覧に戻る
        </Link>
      </div>

      {workspace.rooms.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ルームがありません。CKM API でルームを作成してください。
        </p>
      ) : (
        <ul className="space-y-3">
          {workspace.rooms.map((room) => (
            <li key={room.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400">
              <Link href={`/ckm/${workspace.code}/rooms/${room.id}`} className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{room.title}</h3>
                    {room.topic ? <p className="mt-1 text-sm text-slate-600">{room.topic}</p> : null}
                  </div>
                  <span className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {room.memberCount} メンバー
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
