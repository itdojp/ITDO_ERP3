import Link from "next/link";

export default function ProjectsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Projects PoC</h2>
        <p className="text-sm text-slate-400">
          プロジェクト一覧のUX検討ページです。現時点ではモックデータを表示しつつ、状態遷移や
          外部イベントとの連携パターンを設計するための土台を提供します。
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">
        <p>
          この画面には、以下の要素を順次追加していきます:
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>プロジェクトカードの一覧/検索/フィルタ</li>
          <li>状態遷移アクション（Activate / Hold / Resume / Close）</li>
          <li>Sales イベント連携による自動プロジェクト生成の可視化</li>
        </ul>
      </div>

      <p className="text-sm text-slate-500">
        Timesheets や Compliance 画面も合わせて確認すると、案件→工数→請求までの業務体験を俯瞰できます。
        <Link href="/timesheets" className="text-sky-400 hover:underline">
          次は Timesheets へ
        </Link>
        。
      </p>
    </section>
  );
}
