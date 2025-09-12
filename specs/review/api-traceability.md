# APIトレーサビリティ（要件→API→DB）

記法: 要件 → API（method path） → DBテーブル（主に書込先/参照先）

- Timesheet登録 → POST /api/v1/timesheets → timesheets, tasks(project_id FK)
- プロジェクト採算取得 → GET /api/v1/projects/{id}/profit → projects, timesheets, cost_snapshots
- 受注一覧 → GET /api/v1/sales/orders → （将来）sales_orders, accounts
- 受注作成 → POST /api/v1/sales/orders → sales_orders, sales_order_lines
- 受注更新 → PATCH /api/v1/sales/orders/{id} → sales_orders, sales_order_lines
- 受注確定/履行/キャンセル → POST /api/v1/sales/orders/{id}/(confirm|fulfill|cancel) → sales_orders
- 受注→請求 → POST /api/v1/sales/orders/{id}/invoice → invoices, invoice_lines（元: sales_order_lines）
- 発注一覧 → GET /api/v1/procurement/purchase-orders → purchase_orders, vendors
- 発注作成/更新 → (POST|PATCH) /api/v1/procurement/purchase-orders → purchase_orders, purchase_order_lines
- 発注確定/検収/キャンセル → POST /api/v1/procurement/purchase-orders/{id}/(order|receive|cancel) → purchase_orders
- 発注→買掛 → POST /api/v1/procurement/purchase-orders/{id}/bill → vendor_bills(予定), vendor_bill_lines(予定)
- 電子取引保存 → POST /api/v1/compliance/invoices → compliance_invoices(予定), オブジェクトストレージ
- 電子取引検索 → GET /api/v1/compliance/invoices/search → compliance_invoices(予定)
- 監査検索 → GET /api/v1/audit/logs → audit_logs
- ステータスコード → GET /api/v1/status-codes → *_statuses lookup

備考: 将来テーブル（sales_orders/purchase_orders/vendor_bills 等）は現DDLに未作成。生成対象に応じて追加DDLを切る。
