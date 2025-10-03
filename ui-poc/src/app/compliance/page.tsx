export default function CompliancePage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Compliance PoC</h2>
        <p className="text-sm text-slate-400">
          電子取引（インボイス）検索と添付確認の体験を検証するページです。複合フィルタ、結果一覧、
          添付プレビューなどのUIパターンを段階的に実装していきます。
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">
        <p>検討中の要素：</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>期間・金額・フリーワード・match/operator 等の複合検索フォーム</li>
          <li>検索条件の保存/共有機能、リザルトテーブルの列構成</li>
          <li>添付ファイルのプレビュー / ダウンロード / 監査ログ参照</li>
        </ul>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-xs text-slate-400">
        <p>
          バックエンドとの疎通を確認する際は Podman スタックの `compliance/invoices` エンドポイント
          を利用します。PoC段階ではサンプルレスポンスを利用したモック表示から開始する予定です。
        </p>
      </div>
    </section>
  );
}
