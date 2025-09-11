# インデックス最適化（ドラフト)

- projects: UNIQUE(tenant_id, code), INDEX(status), INDEX(client_id)
- accounts: UNIQUE(tenant_id, code)
- invoices: INDEX(account_id, issue_date), UNIQUE(tenant_id, invoice_number)
- payments: INDEX(invoice_id, paid_on)
- timesheets: INDEX(project_id, work_date), INDEX(user_id, work_date)
- audit_logs: INDEX(tenant_id, occurred_at DESC), INDEX(tenant_id, entity_type, entity_id)

後続でクエリプロファイルに基づき調整。

