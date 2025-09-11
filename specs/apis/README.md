# APIs (Bootstrap)

## 方針
- API-first: OpenAPIを`/openapi`配下に配置（後続PR）。
- 認証/認可: OIDC + RBAC（MFA推奨）。テナントはヘッダ`X-Tenant-ID`。
- バージョン: `/api/v1`。後方互換を基本とし、破壊的変更は次版。

## 代表エンドポイント例
- `GET /api/v1/projects`
- `POST /api/v1/timesheets`
- `GET /api/v1/projects/{id}/profit`（revenue, labor_cost, external_cost, overhead, gross_profit, progress_based_revenue）
- `POST /api/v1/compliance/invoices`（電子取引保存: メタ+PDFアップロード）
- `POST /api/v1/integration/ocr/invoice:process`（OCR実行→買掛起票フロー）

## セキュリティ
- Bearerトークン（OIDC）、スコープ/ロールでAPI権限制御
- 監査ログ: 請求発行/入金登録/権限変更 等

