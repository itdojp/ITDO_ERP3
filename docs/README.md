# Docs Overview

## AI Roadmap
- [AI支援型開発ロードマップ](ai-roadmap.md)
- [AI開発ワークフロー仕様](ai-devflow.md)
- [Codex CLI テンプレート利用ガイド](codex-templates.md)
- [Phase2 モジュール計画](phase2/module-planning.md)
- [Phase2 実装準備プラン](phase2/implementation-plan.md)

## Phase2 Specs
- [CRM モジュール要件定義](specs/crm/requirements.md)
- [販売管理モジュール要件定義](specs/sales/requirements.md)

## Metrics
- [CRM KPI 指標一覧](metrics/crm.md)

## Runbooks
- [HR Ops Runbook](runbooks/hr-ops.md)

## Live Testing
- [Live Testing Guide](live-testing.md)
- GitHub Actions: `Podman Live Playwright Tests` (workflow_dispatch)

## Podman Smoke
- [PoC Smoke Tests](poc_live_smoke.md) - Slack通知やフォールバック設定の詳細ガイド
- [Slack Notification Runbook](slack-runbook.md)
- [Telemetry Dashboard Guide](podman-telemetry-dashboard.md)

## UI Feedback
- [UI PoC フィードバック・バックログ](ui-poc-feedback-backlog.md)
- Project Timeline Panel フィルタ/詳細カード解説は `ui-poc/README.md` を参照

## CLI ユーティリティ
- [Projects Slack 共有 CLI ガイド](projects-share-cli.md)
- `scripts/notifications/send-summary.js` — 要約検索結果を Slack へ通知する CLI（Runbook 参照）
- `scripts/billing/replay-invoice.js` — 請求書生成ジョブを再実行する CLI
- `scripts/templates/create-module.js` — Codex テンプレートから雛形を生成

## UI Testing
- GitHub Actions: `UI PoC E2E`（mock モード Playwright を夜間実行）

## API Examples
- [Projects 一覧のページネーション例](api-projects-pagination.md)

## API Docs
- [OpenAPI (Projects v1)](api/openapi/projects-v1.html)
- [GraphQL (Project API)](api/graphql/index.html)
- 自動生成スクリプト: `./scripts/generate-api-docs.sh`（CI ワークフロー `API Docs` で整合性チェック）

## Finance & Compliance
- [契約/請求 ERD](contracts/erd.md)
- [電子帳簿法チェックリスト](compliance/electronic-book.md)
- [電子帳簿法対応 Runbook](compliance/electronic-ledger-runbook.md)
- [販売管理モジュール 電子帳簿法対応ガイド](compliance/sales-ledger.md)
- [人事モジュール 個人情報保護ガイドライン](compliance/hr-privacy.md)

## BI & Analytics
- [BI データマート設計](bi/data-mart.md)
- [ETL 方式比較](bi/etl-evaluation.md)
- [自然言語クエリ PoC](../examples/bi/nl-query-poc/README.md)

## Services
- [Project API (NestJS)](../services/project-api/README.md)
- [Contract Invoice Pipeline](contracts/invoice-pipeline.md)
- [Project Dashboard (AI ハイライト)](projects/project-dashboard.md)
- [チャット要約検索 / 通知 Runbook](projects/chat-summary-runbook.md)
