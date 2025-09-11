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

