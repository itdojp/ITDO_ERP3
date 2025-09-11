# Modules (Bootstrap)

## Standard（定石）
- accounting（財務会計/総勘定元帳/仕訳取込）
- sales（見積/受注/請求、与信は段階導入）
- procurement（発注/検収/買掛）
- hr-payroll（人事・勤怠・給与：外部SaaS連携から）

## Bespoke（差別化）
- project（案件/プロジェクト/進捗）
- timesheet（工数/承認）
- project-costing（原価計算/進行基準計上）

## 主エンティティ（軽いER要約）
- Project(id, code, name, client, status, start_on, end_on)
- Task(id, project_id, name, status)
- Timesheet(id, user_id, project_id, task_id, work_date, hours, approval_status)
- Contract(id, account_id, terms, progress_method)
- Invoice(id, account_id, issue_date, due_date, status, total, tax_total)
- CostSnapshot(id, project_id, as_of_date, labor_cost, external_cost, overhead, revenue_progress)

関係:
- Project 1—n Task
- Project 1—n Timesheet
- Project 1—n CostSnapshot
- Contract 1—n Invoice
