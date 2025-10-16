# CRM / Sales モジュール リリース手順

Phase3 本実装に合わせて CRM / Sales モジュールを本番適用するためのチェックリストです。対象リポジトリ: `services/project-api`。

## 1. 事前準備
- [ ] `DATABASE_URL` を本番 PostgreSQL に向け、Prisma マイグレーション (`20251015000000_phase3_crm_sales_models`) を適用
- [ ] Seed データで作成されるサンプル顧客/見積データが不要な場合は無効化または削除
- [ ] `SALES_METRICS_ENABLED=true` と AWS IAM 権限を設定し、CloudWatch へメトリクス送信できることを確認 (`QuoteCreatedCount`, `OrderCreatedCount` など)
- [ ] `api/v1/crm`・`api/v1/sales` REST エンドポイントをステージングで疎通確認 (`GET /quotes`, `POST /orders` など)
- [ ] `/api/v1/sales/metrics` と GraphQL `salesMetrics` クエリで KPI スナップショットが取得できることを確認
- [ ] GraphQL スキーマ差分を `npm run lint` で確認

## 2. リリース手順
1. `npm run lint` / `npm run test` を実行し、CI と同等のカバレッジを通過させる
2. `DATABASE_URL` を本番環境の接続文字列に設定し、`npx prisma migrate deploy` を実行
3. `scripts/ci/run-codex-template-smoke.sh` を実行し、新テンプレートのテンプレ生成が成功することを確認
4. `api/v1/crm/customers` / `api/v1/sales/quotes` / `api/v1/sales/metrics` を `curl` で実行し、200 応答と想定データが返ることを確認
5. Slack `#sales-ops`（リリース実況）と `#sales-ops-alerts`（CloudWatch アラート受信）および PagerDuty `Sales Ops` エスカレーションポリシーへリリース開始を共有し、クレジット承認時の通知ルールを再確認

## 3. ロールバック
- [ ] リリース後 60 分以内の障害は `npx prisma migrate resolve --rolled-back` を利用して直近マイグレーションをロールバック
- [ ] CloudWatch ダッシュボード (`sales-overview-<env>`) のアラームが連続発報した場合は `OrderAuditLog` と `CreditReview` を参照して状態復元
- [ ] REST エンドポイントに障害がある場合は API Gateway / ALB で旧バージョンへ切り戻し
- [ ] Slack `#sales-ops-alerts` へロールバックを通知し、PagerDuty インシデントをクローズ

## 4. コミュニケーション
- [ ] リリース完了後に Slack `#product-ai`、`#sales-ops` へ展開完了と KPI 影響を共有
- [ ] 重大な仕様変更は Confluence / Notion のモジュールまとめページを更新

---
最終更新: 2025-10-15 / Maintainer: AI Platform Engineering
