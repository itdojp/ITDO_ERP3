# Docs Overview

## AI Roadmap
- [AI支援型開発ロードマップ](ai-roadmap.md)
- [AI開発ワークフロー仕様](ai-devflow.md)
- [Codex CLI テンプレート利用ガイド](codex-templates.md)

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

## Services
- [Project API (NestJS)](../services/project-api/README.md)
- [Contract Invoice Pipeline](contracts/invoice-pipeline.md)
- [Project Dashboard (AI ハイライト)](projects/project-dashboard.md)
