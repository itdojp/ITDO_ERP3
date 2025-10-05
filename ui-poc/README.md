# ITDO ERP3 UI PoC

本ディレクトリは、ITDO ERP3 の UX 検討を目的とした Next.js ベースのプロトタイプです。
プロジェクト/タイムシート/電子取引の主要フローを順次実装し、画面遷移・コンポーネントの方向性を検証します。

## セットアップ

```bash
cd ui-poc
npm install
cp .env.local.example .env.local  # 必要に応じて API エンドポイントを調整
```

## 起動

### バックエンドとフロントを個別に起動する場合

1. Podman でバックエンド PoC を起動（任意）
   ```bash
   scripts/run_podman_poc.sh
   ```
2. UI を起動
   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 4000
   ```
3. ブラウザで `http://localhost:4000` を開くと、各PoC画面へのナビゲーションを確認できます。

### Podman + UI をまとめて起動する場合

バックエンド PoC と Next.js Dev Server を同時に立ち上げる補助スクリプトも用意しています（事前に `podman-compose` / `npm` / `curl` が利用可能なことを確認してください）。UI 用ポートが使用中の場合はスクリプトが警告を出して終了するので、別ポートを `UI_PORT` で指定するか該当プロセスを停止してください。`UI_HEADLESS=true` を渡すと Next.js をバックグラウンドで起動し、ログは `.next/dev.log` に出力されます。

```bash
scripts/run_podman_ui_poc.sh
```

環境変数 `PM_PORT` (ホスト側の公開ポート、既定 3001) と `UI_PORT` (既定 4000) を指定するとポートを変更できます。必要に応じて `PM_CONTAINER_PORT` でコンテナ内ポートも調整できますが、通常は既定の 3001 のままで問題ありません。PoC API サービスは `/app/state/pm-poc-state.json`（`PM_STATE_FILE` で変更可）に状態を永続化するため、Podman を再起動しても最新状態が復元されます。状態を初期化したい場合は `scripts/reset_pm_state.sh` を実行してください。

```bash
PM_PORT=3101 UI_PORT=4100 scripts/run_podman_ui_poc.sh

> Live テスト (`--run-tests` / `--tests-only`) を利用する場合は、Playwright の実行前に PoC API を既定ポート（3001）へ一旦リダイレクトするため、環境変数 `FORCE_PM_PORT` で強制ポートを指定できます。Podman スタックを独自ポートで常用している場合は、テスト専用に `FORCE_PM_PORT=3001` を維持するか、Playwright 側の `PM_PORT` を合わせて上書きしてください。
```

## ディレクトリ構成（抜粋）

- `src/app` … App Router を用いた画面コンポーネント
  - `/projects` … プロジェクトポートフォリオ PoC（Podman 起動時は `/api/v1/projects` をフェッチ）
  - `/timesheets` … タイムシート承認 PoC（Podman 起動時は `/api/v1/timesheets` をフェッチ）
  - `/compliance` … 電子取引検索 PoC（Podman 起動時は `/api/v1/compliance/invoices` をフェッチ）
- `src/features` … 画面単位のモジュール（型定義・モックデータ・UIロジック）
- `src/lib/api-client.ts` … API呼び出し用の簡易ラッパ

## 今後の予定（Issue #82 を参照）
- 実データ/モックデータの表示やUIパターンの実装
- Podman スタックとの結合テスト強化
- UX検討のための操作シナリオドキュメント整備

> ⚠️ このプロジェクトは PoC 目的のため、本番品質を前提としていません。

## GraphQL プロトタイプ
- バックエンド PoC (`pm-service`) には `http://localhost:3001/graphql` で GraphQL エンドポイントが追加されています。
- GraphiQL が有効な場合は、以下のようなクエリで REST と同等のデータを取得できます。
  ```graphql
  {
    metricsSummary {
      projects
      timesheets
      invoices
      cachedAt
      stale
    }
    projects(status: "active") {
      id
      name
      status
    }
  }
  ```
- Projects 画面には GraphQL 経由の「プロジェクト追加」フォームを実装しており、作成・状態遷移は GraphQL ミューテーションを優先的に利用します（失敗時は REST にフォールバック）。
- Timesheets 画面にも GraphQL のクイック追加フォームと、承認/差戻しアクションの GraphQL 呼び出しが組み込まれています。
- Compliance 画面は GraphQL クエリ `complianceInvoices` を優先利用しており、ページネーション/フィルタ結果のメタ情報を取得できます。
- GraphQL / REST の両経路は Idempotency-Key をサポートしており、UI クライアント側ではフォールバック時に `reportClientTelemetry` / `reportServerTelemetry` を発火して動作状況を記録します。Podman スタックが起動していれば Telemetry イベントは Loki へ転送され、`scripts/show_telemetry.js` で最新イベントを確認できます。
- `/telemetry` ページでは Component/Event/Detail/Level/Origin を条件にフィルタし、15 秒間隔で自動更新が行われます。並び順は `Sort` / `Order` セレクトから変更でき、`?pollMs=1000` や `NEXT_PUBLIC_TELEMETRY_POLL_MS` でポーリング間隔も調整可能です。フィルタ設定は URL クエリと localStorage に記録され再訪時に復元されます。

## 操作シナリオ（PoC 検証観点メモ）
- `Projects` 画面: プロジェクト一覧を確認 → 任意の行を選択 → 状態遷移ボタンで `activate/hold/resume/close` を試行し、イベントログが更新されることを確認。
- `Timesheets` 画面: ステータスフィルタを切り替え → 行の操作ボタンで承認/差戻しを実施 → コメント入力や理由選択を試し、メッセージ表示の挙動を確認。
- `Compliance` 画面: 期間/金額/ステータス/キーワードで検索条件を組み合わせ → 並び順やページサイズを切り替えてリストを確認 → 結果テーブルから行を選択 → 詳細パネルで添付プレビューを開き、モックビューアの流れを確認。Podman スタック停止時は自動的にモックへフォールバックし、バナーと `ライブAPIを再試行` ボタンが表示されます。MinIO 連携を有効にするとダウンロードボタンから署名付きURL経由で添付ファイルを取得できます。
- Home 画面: 「Podman Metrics Snapshot」で `/metrics/summary` のキャッシュ状況と件数分布を確認し、必要に応じてキャッシュ無効化ボタンから再取得を実行。
- Podman 連携時: `scripts/run_podman_ui_poc.sh` でスタックを起動し、Real API モード (`API live` バッジ) とモックモード (`Mock data`) が自動で切り替わることを確認。
  - Podman スタックを起動している場合、プロジェクト/タイムシート/電子取引の PoC API が `/api/v1/...` エンドポイントからサンプルデータを返します。`/api/v1/projects`・`/api/v1/timesheets` の `POST` で追加、`DELETE /api/v1/timesheets/:id` で削除、`/metrics/summary` や `/events/recent` で状況を確認できます。

## E2E テスト
- 依存パッケージのインストール: `cd ui-poc && npm install`
- Playwright ドライバの取得: `cd ui-poc && npx playwright install chromium`
- テスト実行: `cd ui-poc && npm run test:e2e`
- Podman を起動して API 連携（`API live` バッジ）を確認したい場合は `npm run test:e2e:live` を利用してください。MinIO を必須として検証する場合は `E2E_REQUIRE_MINIO=true` を併用し、GraphQL ウォームアップを無効化したいときは `SKIP_GRAPHQL_PREFLIGHT=true` を指定します。
- GitHub Actions の `api-live-minio` ワークフローを実行すると、MinIO 有効化 (`USE_MINIO=true`) と署名付き URL 検証 (`E2E_REQUIRE_MINIO=true`) を含む Podman ベースのライブシナリオを CI 上で確認できます。
- `npm run test:e2e` は Telemetry 再試行バナーと SSE の動作モック（`tests/e2e/metrics.spec.ts`）も検証します。ライブ API と組み合わせる場合は `E2E_EXPECT_API=true` を設定してください。

## 補助スクリプト
- `node ../scripts/show_telemetry.js` — Telemetry API の最新イベントを CLI で確認します。`TELEMETRY_BASE` でベースURLを上書き可能です。
- `node ../scripts/metrics_stream_stress.js` — 複数クライアントで `/metrics/stream` を購読する簡易ロードテスト。`METRICS_STREAM_CLIENTS`/`METRICS_STREAM_URL` などの環境変数で調整できます。
- GitHub Actions やローカルでのライブ検証手順は `docs/live-testing.md` にまとめています。
