import { MetricsPanel } from "@/features/metrics/MetricsPanel";

export default function Home() {
  return (
    <section className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg shadow-slate-950/60">
        <h2 className="text-2xl font-semibold tracking-tight">UI PoC 概要</h2>
        <p className="mt-2 text-sm text-slate-300">
          このアプリは ITDO ERP3 の UX 検討用プロトタイプです。左上のナビゲーションから対象機能
          （Projects / Timesheets / Compliance）を選ぶと、それぞれのPoC画面にアクセスできます。
        </p>
        <p className="mt-2 text-sm text-slate-400">
          画面はサンプルデータまたは Podman 上の PoC バックエンドと連携して動作します。実運用の
          デザインやフローは今後の検討事項です。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Projects",
            description: "プロジェクトのステータス管理と外部イベント連携を確認する画面です。",
          },
          {
            title: "Timesheets",
            description: "承認待ち工数のレビュー/承認/差戻しを擬似体験し、ワークフローUXを検討します。",
          },
          {
            title: "Compliance",
            description: "電子取引（インボイス）検索と添付確認の操作性を検証する画面です。",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-lg font-semibold text-white">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{card.description}</p>
          </div>
        ))}
      </div>

      <MetricsPanel />

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">
        <h3 className="text-base font-semibold">ローカル実行メモ</h3>
        <ol className="mt-3 space-y-2 list-decimal list-inside text-slate-400">
          <li>Podman スタックを起動: <code>scripts/run_podman_poc.sh</code></li>
          <li>別ターミナルで UI を起動: <code>cd ui-poc &amp;&amp; npm run dev -- --port 4000</code></li>
          <li>ブラウザで <code>http://localhost:4000</code> を開き、各画面を操作</li>
        </ol>
      </div>
    </section>
  );
}
