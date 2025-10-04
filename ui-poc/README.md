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

バックエンド PoC と Next.js Dev Server を同時に立ち上げる補助スクリプトも用意しています（事前に `podman-compose` / `npm` / `curl` が利用可能なことを確認してください）。UI 用ポートが使用中の場合はスクリプトが警告を出して終了するので、別ポートを `UI_PORT` で指定するか該当プロセスを停止してください。

```bash
scripts/run_podman_ui_poc.sh
```

環境変数 `PM_PORT` (ホスト側の公開ポート、既定 3001) と `UI_PORT` (既定 4000) を指定するとポートを変更できます。必要に応じて `PM_CONTAINER_PORT` でコンテナ内ポートも調整できますが、通常は既定の 3001 のままで問題ありません。PoC API サービスは `/app/state/pm-poc-state.json`（`PM_STATE_FILE` で変更可）に状態を永続化するため、Podman を再起動しても最新状態が復元されます。

```bash
PM_PORT=3101 UI_PORT=4100 scripts/run_podman_ui_poc.sh
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

## 操作シナリオ（PoC 検証観点メモ）
- `Projects` 画面: プロジェクト一覧を確認 → 任意の行を選択 → 状態遷移ボタンで `activate/hold/resume/close` を試行し、イベントログが更新されることを確認。
- `Timesheets` 画面: ステータスフィルタを切り替え → 行の操作ボタンで承認/差戻しを実施 → コメント入力や理由選択を試し、メッセージ表示の挙動を確認。
- `Compliance` 画面: 期間/金額/ステータス/キーワードで検索条件を組み合わせ → 結果テーブルから行を選択 → 詳細パネルで添付プレビューを開き、モックビューアの流れを確認。
- Podman 連携時: `scripts/run_podman_ui_poc.sh` でスタックを起動し、Real API モード (`API live` バッジ) とモックモード (`Mock data`) が自動で切り替わることを確認。
  - Podman スタックを起動している場合、プロジェクト/タイムシート/電子取引の PoC API が `/api/v1/...` エンドポイントからサンプルデータを返します。`/api/v1/projects`・`/api/v1/timesheets` の `POST` で追加、`DELETE /api/v1/timesheets/:id` で削除、`/metrics/summary` や `/events/recent` で状況を確認できます。

## E2E テスト
- 依存パッケージのインストール: `cd ui-poc && npm install`
- Playwright ドライバの取得: `cd ui-poc && npx playwright install chromium`
- テスト実行: `cd ui-poc && npm run test:e2e`
- Podman を起動して API 連携（`API live` バッジ）を確認したい場合は `npm run test:e2e:live` を利用してください。
