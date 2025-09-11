# コンプライアンス（インボイス/電帳法）MVP

## 目的
- 電子取引保存要件のMVPを満たす: 改ざん防止、検索性、時刻情報の保持

## 要件（要点）
- 改ざん防止: ファイルハッシュ（SHA-256）と変更履歴の保持
- 検索キー: 取引日、金額、相手先（＋任意キー）
- 時刻情報: 保存時刻/取引時刻の保持、タイムスタンプ付与
- タイムスタンプ手段: 外部TSA(RFC3161) または システム時刻（要件に応じ選択）。`timestamp_method` で指定。
- 監査: 保存/参照/削除（論理）操作の監査ログ

## ストレージ
- オブジェクトストレージ（例: S3）にPDF保存、URIはDBに保持
- メタデータ: invoice_number, issue_date, counterparty, amount, tax_amount, file_uri, hash, timestamp, searchable_keys

## API（MVP）
- POST `/api/v1/compliance/invoices` … 電子取引保存（202 Accepted）。保存ジョブ非同期実行。
- GET `/api/v1/compliance/invoices/search` … 検索キーで一覧取得（ページング）

### 検索仕様の詳細
- 一致種別: `match=exact|partial`
- 結合: `operator=and|or`
- 自由語: `q`（対象: `invoice_number`, `counterparty`）

### レスポンス例（要約）
```json
{
  "items": [
    { "id": "ci_001", "invoice_number": "A-2025-0001", "issue_date": "2025-09-01", "counterparty": "ABC社", "amount": 100000, "file_uri": "s3://...",
      "highlights": { "invoice_number": ["<em>A-2025</em>-0001"], "counterparty": ["<em>ABC</em>社"] } }
  ],
  "next_cursor": "eyJpZCI6ICJjaV8wMDEifQ=="
}
```

## セキュリティ/監査
- OIDC + RBAC。監査対象操作（保存/検索/閲覧/削除）は監査ログへ記録
