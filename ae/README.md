# AE Framework 入力（モジュール別生成）

本フォルダは https://github.com/itdojp/ae-framework を用いた自動生成のための入力定義をまとめます。
- グローバル設定: `ae/config.yaml`
- モジュール定義: `ae/modules/*/module.yaml`
- 状態遷移: `ae/modules/*/states.yaml`
- 権限/ロール: `ae/permissions.yaml`

原本のAPI仕様/DDLは以下を参照します。
- OpenAPI: `openapi/v1/openapi.yaml`
- スキーマDDL: `db/schema.sql` + `db/migrations/*.sql`

生成の考え方
- OpenAPIのtag/パスプレフィックスでモジュールを切り出します
- DBテーブルの責務（owned_tables）を明示し、JOINが必要な箇所はrelationsでヒントを付与します
- 状態遷移は state machine として定義し、アクション（/confirm など）にバインドします
