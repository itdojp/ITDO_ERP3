import Link from "next/link";

export default function TimesheetsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Timesheets PoC</h2>
        <p className="text-sm text-slate-400">
          工数承認ワークフローのUX検証を行うページです。承認待ちリストや詳細パネル、一括承認など
          実際の運用シナリオを意識したコンポーネントを順次追加予定です。
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">
        <p>今後の差し込み予定：</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>承認待ち + 差戻し済みタブ表示</li>
          <li>コメント入力・理由コード選択付きの差戻しモーダル</li>
          <li>`/timesheets/{id}/approve` など Podman API との連携</li>
        </ul>
      </div>

      <p className="text-sm text-slate-500">
        インボイス検索UXは Compliance 画面にて検証します。
        <Link href="/compliance" className="text-sky-400 hover:underline">
          Compliance 画面を見る
        </Link>
        。
      </p>
    </section>
  );
}
