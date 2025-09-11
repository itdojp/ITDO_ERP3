# ERD 詳細化（MVP）

対象: Project / Timesheet / Project-Costing / Billing / Contracts の最小スコープ。
全テーブルに `tenant_id`, `created_at`, `updated_at`, `deleted_at`（NULL=有効）。

## テーブルと主キー
- tenants (id PK, name, status)
- users (id PK, tenant_id FK, email UNIQUE, name, status)
- accounts (id PK, tenant_id FK, code UNIQUE, name, qualified_invoice_number?, tax_category)
- projects (id PK, tenant_id FK, code UNIQUE, name, client_id FK→accounts.id, status, start_on, end_on)
- project_members (project_id FK, user_id FK, tenant_id FK, role, cost_rate, PRIMARY KEY(project_id, user_id))
- tasks (id PK, tenant_id FK, project_id FK, name, status)
- timesheets (id PK, tenant_id FK, user_id FK, project_id FK, task_id?, work_date, hours, approval_status)
- contracts (id PK, tenant_id FK, account_id FK, type, start_on, end_on, billing_terms, progress_method)
- invoices (id PK, tenant_id FK, account_id FK, issue_date, due_date, status, invoice_number UNIQUE, total, tax_total)
- invoice_lines (id PK, invoice_id FK, item_code?, description, qty, unit_price, tax_rate, tax_code, created_at, updated_at, deleted_at)
- payments (id PK, tenant_id FK, invoice_id FK, amount, paid_on, method)
- cost_snapshots (id PK, tenant_id FK, project_id FK, as_of_date, labor_cost, external_cost, overhead, revenue_progress, gross_profit)
- journal_exports (id PK, tenant_id FK, period, status, file_uri)

## 制約/方針
- 金額は numeric(18,2)、税率は numeric(5,2)
- 参照整合: CASCADEは基本不使用、論理削除で一貫性維持
- インデックス: 主たる検索キー（project_id, work_date, invoice_number, account_id, as_of_date）
- RLSを前提（`tenant_id`でフィルタ）

## 関係（概要）
- Project 1—n Task / Timesheet / CostSnapshot
- Account 1—n Project / Contract / Invoice / Payment
- Invoice 1—n InvoiceLine
- Project n—n User（via ProjectMember）
