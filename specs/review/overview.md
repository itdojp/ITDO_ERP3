# 仕様レビュー概要（AE Framework入力前提）

目的: ae-frameworkでの自動生成前に、モジュール範囲・責務・API/DBの対応・非機能方針を俯瞰し、妥当性確認を行う。

対象モジュール
- Projects/Timesheets/Costing
- Sales（受注）/Procurement（発注）
- Compliance（電子取引保存）/Audit（監査）
- Metadata（status-codes）

確認観点（要約）
- 境界: モジュール責務が重複/過不足なく分割されているか
- API: 一覧/詳細/作成/更新/遷移/連携の必須ユースケースを網羅しているか
- DB: エンティティ属性・制約・FK/ON DELETE方針が整合しているか
- 横断: 認証/認可・テナント・監査・丸め/税・冪等・ページング/ソート

参照ドキュメント索引
- OpenAPI: `openapi/v1/openapi.yaml`
- DDL: `db/schema.sql`, `db/migrations/*.sql`
- セマンティクス: `specs/update-semantics.md`, `specs/api-errors.md`, `specs/linking.md`
- ERD: `specs/erd.md`, `specs/erd-attributes.md`, `specs/db-policy.md`, `specs/db-indexes.md`, `specs/db-status-fk-migration.md`
- Compliance/Audit: `specs/compliance.md`, `specs/audit.md`
- AE入力: `ae/config.yaml`, `ae/modules/*`, `ae/permissions.yaml`
