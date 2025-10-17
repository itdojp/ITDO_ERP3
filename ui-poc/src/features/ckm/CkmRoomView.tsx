'use client';

import { useMemo, useState, useTransition } from 'react';
import { postCkmMessage } from './api';
import type { CkmMessage, CkmChatRoomSummary } from './types';

type Props = {
  workspaceCode: string;
  room: CkmChatRoomSummary;
  initialMessages: CkmMessage[];
};

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) {
    return '数秒前';
  }
  if (diffMs < hour) {
    const minutes = Math.round(diffMs / minute);
    return `${minutes}分前`;
  }
  if (diffMs < day) {
    const hours = Math.round(diffMs / hour);
    return `${hours}時間前`;
  }
  const days = Math.round(diffMs / day);
  return `${days}日前`;
}

export function CkmRoomView({ workspaceCode, room, initialMessages }: Props) {
  const [messages, setMessages] = useState<CkmMessage[]>(() => initialMessages);
  const [body, setBody] = useState('');
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredMessages = useMemo(() => {
    if (!keyword.trim()) {
      return messages;
    }
    const needle = keyword.trim().toLowerCase();
    return messages.filter((message) => message.body.toLowerCase().includes(needle));
  }, [messages, keyword]);

  const handleSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const created = await postCkmMessage({
          workspaceCode,
          roomId: room.id,
          body: trimmed,
        });
        setMessages((prev) => [created, ...prev]);
        setBody('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{room.title}</h1>
        {room.topic ? <p className="mt-1 text-sm text-slate-600">{room.topic}</p> : null}
        <p className="mt-2 text-xs text-slate-500">{room.memberCount} メンバー</p>
      </header>

      <form onSubmit={handleSubmit} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">メッセージを投稿</label>
        <textarea
          className="mt-2 w-full rounded border border-slate-300 p-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none"
          rows={3}
          value={body}
          onChange={(evt) => setBody(evt.target.value)}
          placeholder="リアルタイムで共有したい内容を入力してください"
          disabled={isPending}
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            `X-User-Id` ヘッダーには <code>{process.env.NEXT_PUBLIC_CKM_USER_ID ?? 'user-alice'}</code> が利用されます。
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isPending || body.trim().length === 0}
          >
            {isPending ? '送信中…' : '送信'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">投稿に失敗しました: {error}</p> : null}
      </form>

      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">最近のメッセージ</h2>
          <input
            type="search"
            placeholder="メッセージ検索"
            value={keyword}
            onChange={(evt) => setKeyword(evt.target.value)}
            className="w-56 rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        {filteredMessages.length === 0 ? (
          <p className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            メッセージがありません。最初の投稿を作成しましょう。
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredMessages.map((message) => (
             <li key={message.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{message.authorId}</span>
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(message.postedAt)} ({new Date(message.postedAt).toLocaleString()})
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
                {message.deletedAt ? <p className="mt-1 text-xs text-red-500">このメッセージは削除されました。</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
