# ステータスコードAPI（ドラフト）

- エンドポイント: `GET /api/v1/status-codes?domain=task|timesheet|invoice`
- 目的: クライアントが列挙や表示名を動的に取得するための簡易メタデータAPI
- レスポンス: `{ items: [{ code, name }] }`
- データ源: DBのlookupテーブル（task_statuses / timesheet_statuses / invoice_statuses）
- キャッシュ: 数分〜数時間のキャッシュ可（頻繁に変化しない）

今後: ドメイン拡張や無効化フラグ、並び順などを追加検討。
