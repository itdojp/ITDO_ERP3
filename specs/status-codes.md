# ステータスコードAPI（ドラフト）

- エンドポイント: `GET /api/v1/status-codes?domain=task|timesheet|invoice|sales_order|purchase_order|project`
- 目的: クライアントが列挙や表示名を動的に取得するための簡易メタデータAPI
- レスポンス: `{ items: [{ code, name, active, ordinal }] }`
- データ源: DBのlookupテーブル（task_statuses / timesheet_statuses / invoice_statuses）
- キャッシュ: 数分〜数時間のキャッシュ可（頻繁に変化しない）

パラメータ:
- `active=true|false`（true指定で有効のみ）
- `sort=ordinal|code|name`（降順は `-field`）

今後: ドメイン拡張や無効化フラグ、並び順などを追加検討（active/ordinalは任意）。
