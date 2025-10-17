import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCkmRoomMessages, getCkmWorkspaceDetail } from '@/features/ckm/api';
import { CkmRoomView } from '@/features/ckm/CkmRoomView';

export const dynamic = 'force-dynamic';

type Params = Promise<{ workspaceCode: string; roomId: string }>;

type Props = {
  params: Params;
};

export default async function CkmRoomPage({ params }: Props) {
  const { workspaceCode, roomId } = await params;
  let workspace;
  try {
    workspace = await getCkmWorkspaceDetail(workspaceCode);
  } catch (error) {
    console.warn('[ckm] workspace fetch failed', error);
    return notFound();
  }
  const room = workspace.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return notFound();
  }
  const messages = await getCkmRoomMessages(workspaceCode, roomId);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href={`/ckm/${workspace.code}`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
          ルーム一覧に戻る
        </Link>
        <Link href="/ckm" className="text-sm text-slate-500 hover:text-slate-700">
          ワークスペース一覧
        </Link>
      </div>
      <CkmRoomView workspaceCode={workspace.code} room={room} initialMessages={messages} />
    </div>
  );
}
