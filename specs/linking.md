# 受注→請求／発注→買掛 の連携仕様（ドラフト）

## 受注（SalesOrder）→ 請求（Invoice）
- 行マッピング: SalesOrderLine → InvoiceLine（item_code/description/qty/unit_price）
- 金額・税
  - line_amount = qty × unit_price（丸めは可変、デフォルト: 小数2桁、四捨五入）
  - tax_rate は品目/契約/税区分の規則で決定（例: 10%, 0%）
  - invoice.total = Σ line_amount、invoice.tax_total = Σ (line_amount × tax_rate)
  - 端数丸めオプション:
    - 集計単位: `line`（行単位で丸めて合算）/ `document`（最終合計で丸め）
    - 丸め方式: `half_up`（四捨五入）/ `half_even`（銀行丸め）/ `truncate`（切り捨て）
    - 設定箇所: テナント設定 or 契約単位で上書き
- タイミング: confirmed/fulfilled のいずれかでトリガ可能（運用定義）

## 発注（PurchaseOrder）→ 買掛（VendorBill）
- 行マッピング: PurchaseOrderLine → VendorBillLine（スキーマは将来拡張）
- 金額・税の丸め規則は受注→請求と同様
- 検収時（receive）またはベンダー請求受領時に作成

## 共通
- 通貨/税区分はテナント設定・取引先設定に依存
- 既存の請求/買掛に対して重複作成しないための冪等キー（order_id/po_id + バージョン）
- 監査: 連携実行者/時刻/対象（order_id/po_id → invoice_id/bill_id）を監査ログに記録
