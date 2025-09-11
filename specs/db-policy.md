# DB制約/ポリシー（MVP）

- 外部キーは原則 `ON DELETE RESTRICT` とし、親の論理削除で整合性を維持
- `timesheets.task_id` 参照は `ON DELETE SET NULL`（タスク削除時、工数は残す）
- 監査列 `created_at`/`updated_at` は NOT NULL + DEFAULT now()
- マルチテナント列 `tenant_id` は全テーブル必須、RLSで強制
- 金額 `NUMERIC(18,2)`、進行率 `NUMERIC(5,4)` を基本

今後の検討:
- CHECK制約（税率範囲、ステータス列の列挙）
- 一意制約の洗い出し強化（コード/番号の採番ポリシー）

