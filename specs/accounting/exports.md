# 会計連携: 仕訳エクスポート仕様（案）

- フォーマット: CSV（UTF-8, ヘッダ有）
- ファイル命名: `journal_{tenant}_{period}.csv`（例: journal_acme_2025-09.csv）
- S3配置: `s3://{bucket}/journal-exports/{tenant}/{period}/journal_*.csv`
- カラム（例）
  - date, account_code, subaccount_code, dept_code, project_code, description, debit, credit, tax_code, counterparty
- 生成API: POST /api/v1/accounting/journal-exports { period }
- ステータス: db/journal_exports（status=pending|processing|done|failed, file_uri）
