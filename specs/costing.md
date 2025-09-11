# 進行基準・原価計算（MVP）

対象: project-costing。独自価値（プロジェクト×工数×原価×進行基準）の中核。

## 用語
- 実績工数: 承認済みTimesheetの合計時間
- 労務費: 実績工数 × 個別レート（project_members.cost_rate等）
- 外注費: 購買/経費からの集計（MVPでは手入力/CSV取込も可）
- 間接費: 配賦（固定額/労務費比例/外注費比例等）
- 進行基準: cost（コスト比例）/ effort（出来高=工数比例）/ milestone（工程）

## 指標と算式（ドラフト）
- progress_cost = 累計発生原価 / 予定原価（閾値上限=1.0）
- progress_effort = 消化工数 / 予定工数（上限=1.0）
- progress_milestone = 完了工程数 / 全工程数
- progress = 選択した進行基準（contracts.progress_method）に応じて上記いずれか
- revenue_progress = 契約金額 × progress（検収/出来高認定ロジックは運用定義に従う）
- gross_profit = revenue_progress − (労務費 + 外注費 + 間接費)

## スナップショット
- 粒度: 日次（cost_snapshots.as_of_date）
- 項目: labor_cost, external_cost, overhead, revenue_progress, gross_profit
- 入力源: timesheets, 購買/経費、配賦ルール

## API 契約（関連）
- GET `/api/v1/projects/{id}/profit` → ProfitResponse（revenue, labor_cost, external_cost, overhead, gross_profit, progress_based_revenue）
- 今後: 計算根拠の内訳/配賦ポリシーを返す拡張（`?include=breakdown`）

## DoD（Issue #27）
- ダミーデータによるE2E計算サンプル
- 単体テスト（進行基準の切替/境界値）
- スナップショット更新のリトライ/順序性（Outbox/キュー）設計

