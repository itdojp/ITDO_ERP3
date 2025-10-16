# Sprint5-8 ボード登録テンプレート (Phase2/3)

Issue #302 の GitHub Projects ボード整備を効率化するため、Sprint5〜8 に登録すべきカードと KPI ウィジェット案をまとめる。`gh project item-add` で投入する際は本テンプレートを参照する。

## 共通メタデータ
- **ボード**: Phase2 CRM/Sales/HR/BI (Sprint5〜8)
- **ビュー**:
  - Backlog (status = Todo)
  - Sprint (status = In Progress)
  - Review (status = In Review／Blocked)
  - Done
- **フィールド**: Status, Iteration, Assignee, Target Release, KPI Link, Risk Level
- **KPI カード共通**: タイプ = Chart、ソース = GitHub Actions Insights → Workflow: `crm-sales-module-ci`, `hr-module-ci`, `ai-ops-langgraph-verify`

## Sprint5 (CRM/Sales 着手)
| 種別 | タイトル例 | 詳細/リンク | 担当候補 |
|------|------------|-------------|----------|
| Issue | CRM Sales CI パイプライン導入 | PR #310 (`feature/phase3-crm-sales-ci`) をマージし稼働確認 | @ootakazuhiko |
| Issue | CRM GraphQL 結合テスト拡充 | `services/project-api/test/crm/*.spec.ts` 追加 | @backend-dev |
| Task  | Sales Metrics CloudWatch DashBoard Review | `iac/terraform/sales-monitoring` のアラーム閾値レビュー | @dev-sre |
| KPI   | `crm-sales-module-ci` 成功率 | GitHub Insights チャート | N/A |

## Sprint6 (HR Automation)
| 種別 | タイトル例 | 詳細/リンク | 担当候補 |
|------|------------|-------------|----------|
| Issue | HR リマインド API デプロイ | PR #311 (`feature/phase3-hr-automation`) 本番適用と Slack 通知検証 | @people-ops |
| Issue | SkillTag 推定 UI 連携 | `ui` レポ内 HR 画面への API 接続 | @frontend-dev |
| Task  | HR Module CI Coverage Review | `.github/workflows/hr-module-ci.yml` 対象に E2E ケースを追加 | @qa-lead |
| KPI   | `hr-module-ci` 成功率 | GitHub Insights チャート | N/A |

## Sprint7 (BI/Athena)
| 種別 | タイトル例 | 詳細/リンク | 担当候補 |
|------|------------|-------------|----------|
| Issue | Analytics Observability Terraform plan/apply | `iac/terraform/analytics-observability` の terraform plan 実行とレビュー | @dev-sre |
| Issue | Athena NL Query PoC 本番接続 | `examples/bi/nl-query-poc` に本番クレデンシャルを接続し結果レビュー | @bi-lead |
| Task  | QuickSight Dashboard 初回レビュー | `docs/bi/quicksight-dashboard-template.yaml` を基にテンプレ作成 | @bi-analyst |
| KPI   | Analytics SLA チャート | カスタムメトリクス (KpiRefreshLatency) 可視化 | N/A |

## Sprint8 (AI Ops)
| 種別 | タイトル例 | 詳細/リンク | 担当候補 |
|------|------------|-------------|----------|
| Issue | AI Ops Runbook QA & Drill | PR #312 反映後のプレイブック実地訓練 | @ai-ops |
| Issue | Codex Smoke → Auto Handoff 自動承認条件検証 | `ai-devflow.yaml` の Phase3 Gate 条件テスト | @platform-pm |
| Task  | AI Ops KPI Dashboard 更新自動化 | `docs/ai/ops-dashboard.md` の更新スクリプト作成 | @data-eng |
| KPI   | `ai-ops-langgraph-verify` 成功率 | GitHub Insights チャート | N/A |

## KPI ウィジェット追加手順
1. Projects ビュー右上の **+ New Chart** をクリック。
2. Data source: **Workflow runs** / Workflow: それぞれの CI 名を選択。
3. Filter: Branch = `main`, Time range = 14 days。
4. 保存後、カードタイトルをテンプレートに記載の名称へ変更。

## 登録メモ
- `gh project list --owner itdojp` → ボード番号を確認 (`--format` フラグで ID 抽出)。
- `gh project item-add <project-id> --owner itdojp --content-url <issue/pr url>` でカードを追加。
- `gh project item-edit` で Status/Iteration を設定。Iteration は Sprint5〜8 の日付レンジを事前作成しておく。
- Issue #302 へは、登録完了後に実施状況（例：Sprint5〜8 作成済・KPI 4件追加）をコメント。

