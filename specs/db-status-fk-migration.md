# ステータス列のFK移行方針（ドラフト）

目的: 既存のCHECK制約（列挙）からLookupテーブルへのFKへ段階移行し、整合性と拡張性を高める。

## 対象
- tasks.status → task_statuses(code)
- timesheets.approval_status → timesheet_statuses(code)
- invoices.status → invoice_statuses(code)

## 手順（例: invoices.status）
1. 既存値の正規化（異表記を修正）
2. Lookupにコード投入（draft/issued/paid/cancelled）
3. FKを`NOT VALID`で追加（ダウンタイム回避）
   - `ALTER TABLE invoices ADD CONSTRAINT invoices_status_fk FOREIGN KEY (status) REFERENCES invoice_statuses(code) NOT VALID;`
4. 検証実行
   - `ALTER TABLE invoices VALIDATE CONSTRAINT invoices_status_fk;`
5. CHECK制約を除去（移行完了後）
6. アプリ側の列挙はLookup参照へ切替

## ロールバック
- FKをDROPしてCHECKを一時復帰。データ不整合の修復後に再適用。

## 備考
- 将来的に多言語名称はLookup側で管理
- 監査はコード値の変更/追加を記録

