# コンプライアンス（インボイス/電帳法）MVP

## 目的
- 電子取引保存要件のMVPを満たす: 改ざん防止、検索性、時刻情報の保持

## 要件（要点）
- 改ざん防止: ファイルハッシュ（SHA-256）と変更履歴の保持
- 検索キー: 取引日、金額、相手先（＋任意キー）
- 時刻情報: 保存時刻/取引時刻の保持、タイムスタンプ付与
- 監査: 保存/参照/削除（論理）操作の監査ログ

## ストレージ
- オブジェクトストレージ（例: S3）にPDF保存、URIはDBに保持
- メタデータ: invoice_number, issue_date, counterparty, amount, tax_amount, file_uri, hash, timestamp, searchable_keys

## API（MVP）
- POST `/api/v1/compliance/invoices` … 電子取引保存（202 Accepted）。保存ジョブ非同期実行。
- GET `/api/v1/compliance/invoices/search` … 検索キーで一覧取得（ページング）

## セキュリティ/監査
- OIDC + RBAC。監査対象操作（保存/検索/閲覧/削除）は監査ログへ記録

