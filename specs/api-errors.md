# APIエラー方針（ドラフト）

- エラーモデル: `{ error: { code, message, details[] } }`
- 主なHTTPコード
  - 400 Bad Request: フォーマット不正
  - 401/403: 認証/認可
  - 409 Conflict: 重複作成・状態遷移の衝突（例: 連携APIの重複）
  - 422 Unprocessable Entity: 検証エラー（例: 税率未設定、丸め設定不整合）
- 冪等: `Idempotency-Key` ヘッダで同一リクエストの再実行を許容
