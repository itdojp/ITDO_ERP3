# AI Ops Dashboard (Phase3)

本ダッシュボードは AI Ops 自動化ワークフローの主要 KPI を手動でトラッキングするためのメモです。日次チェック時に最新値を更新し、Insights レポートと照合してください。

| 日付 | Codex Smoke Failure Rate | LangGraph Verify Latency (sec) | Auto Handoff Lead Time (min) | 備考 |
|------|--------------------------|--------------------------------|------------------------------|------|
| 2025-10-16 | _pending_ | _pending_ | _pending_ | 初版作成 |

## 更新手順
1. GitHub Actions Insights から対象ワークフロー（Codex Template Smoke, AI Ops LangGraph Verify, AI Ops Auto Handoff）の最新実行結果を取得。
2. しきい値を超えた項目があれば Slack `#ai-ops-alerts` に共有し、Runbook の対応手順を実施。
3. 週次まとめ時は Issue #305 / #159 にリンクを添えてコメントを残す。

---
最終更新: 2025-10-16 / Maintainer: AI Ops Team
