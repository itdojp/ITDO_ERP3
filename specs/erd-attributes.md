# ERD属性詳細（MVP）

各テーブルの主属性・必須・型のサマリ（抜粋）。完全版はDDL参照。

- projects(id text pk, tenant_id text not null, code text not null unique(tenant,code), name text not null, client_id text, status text not null, start_on date, end_on date, created_at ts not null, ...)
- tasks(id text pk, tenant_id text not null, project_id text not null, name text not null, status text not null check in, created_at ts not null, ...)
- timesheets(id text pk, tenant_id text not null, user_id text not null, project_id text not null, task_id text null, work_date date not null, hours numeric(6,2) >=0, approval_status text not null check in, created_at ts not null, ...)
- invoices(id text pk, tenant_id text not null, account_id text not null, issue_date date not null, due_date date, status text not null check in, invoice_number text not null unique(tenant,number), total numeric(18,2) >=0, tax_total numeric(18,2) >=0, created_at ts not null, ...)
- invoice_lines(id text pk, invoice_id text not null, item_code text, description text, qty numeric(12,2) not null default 1, unit_price numeric(18,2) not null default 0, tax_rate numeric(5,2) 0..100, tax_code text, created_at ts not null, ...)
- payments(id text pk, tenant_id text not null, invoice_id text not null, amount numeric(18,2) >=0, paid_on date not null, method text, created_at ts not null, ...)
- cost_snapshots(id text pk, tenant_id text not null, project_id text not null, as_of_date date not null, revenue_progress numeric(5,4) 0..1, gross_profit numeric(18,2), created_at ts not null, ...)
- audit_logs(id text pk, tenant_id text not null, occurred_at ts not null default now, actor_user_id text, action text not null, entity_type text, entity_id text, before_data jsonb, after_data jsonb, ip text, user_agent text)

索引・一意・ON DELETEなどの方針は db-policy.md を参照。
