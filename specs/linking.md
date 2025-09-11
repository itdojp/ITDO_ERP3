# 受注→請求／発注→買掛 の連携仕様（ドラフト）

## 受注（SalesOrder）→ 請求（Invoice）
- 行マッピング: SalesOrderLine → InvoiceLine（item_code/description/qty/unit_price）
- 金額・税
  - line_amount = qty × unit_price（丸め: 小数2桁、四捨五入）
  - tax_rate は品目/契約/税区分の規則で決定（例: 10%, 0%）
  - invoice.total = Σ line_amount、invoice.tax_total = Σ (line_amount × tax_rate)
  - 端数丸め: line単位で丸め、合計は行合算（契約要件で切替可能）
- タイミング: confirmed/fulfilled のいずれかでトリガ可能（運用定義）

## 発注（PurchaseOrder）→ 買掛（VendorBill）
- 行マッピング: PurchaseOrderLine → VendorBillLine（スキーマは将来拡張）
- 金額・税の丸め規則は受注→請求と同様
- 検収時（receive）またはベンダー請求受領時に作成

## 共通
- 通貨/税区分はテナント設定・取引先設定に依存
- 既存の請求/買掛に対して重複作成しないための冪等キー（order_id/po_id + バージョン）
- 監査: 連携実行者/時刻/対象（order_id/po_id → invoice_id/bill_id）を監査ログに記録
