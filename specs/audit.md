# 監査ログ（MVP）

## 目的
- 重要操作（請求発行/入金登録/権限変更/電子取引保存 等）の証跡を保持

## テーブル（案）
- audit_logs(
  id, tenant_id, occurred_at, actor_user_id, action, entity_type, entity_id,
  before_data JSONB, after_data JSONB, ip, user_agent
)
- インデックス: (tenant_id, occurred_at DESC), (tenant_id, entity_type, entity_id)
- 保持: 1〜7年（法要件/運用で確定）

## 収集
- API層で記録（認可決定/パラメータ/結果）
- PII最小化（必要に応じてマスキング）

## マスキング方針（例）
- 個人情報/機密値（メール、住所、請求書PDFのURI等）は部分マスクまたはハッシュ
- before/afterは差分のみ記録し、全文は保持しない（必要最小限）
- コンフィグで項目単位の除外/縮約を設定可能にする

## 閲覧権限（RBAC）
- 監査閲覧: `role=audit_viewer` 以上に限定（原則 読取専用）
- 監査エクスポート: `role=audit_admin` に限定（期間/範囲指定、二要素必須）
- 自組織のテナントデータのみアクセス可能（RLS）

## 差分表現（例）
```json
{
  "id": "log_123",
  "occurred_at": "2025-09-11T10:00:00Z",
  "action": "INVOICE_ISSUED",
  "entity_type": "invoice",
  "entity_id": "inv_001",
  "changes": [
    { "field": "status", "before": "draft", "after": "issued" },
    { "field": "invoice_number", "before": null, "after": "A-2025-0001" }
  ]
}
```

### 既定の除外（例）
- `email`, `address`, `file_uri`, `token`, `password`, `secret` など
