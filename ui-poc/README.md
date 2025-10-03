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

1. Podman でバックエンド PoC を起動（任意）
   ```bash
   scripts/run_podman_poc.sh
   ```
2. UI を起動
   ```bash
   npm run dev -- --port 4000
   ```
3. ブラウザで `http://localhost:4000` を開くと、各PoC画面へのナビゲーションを確認できます。

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
