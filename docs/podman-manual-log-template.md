# Podman 手動検証ログテンプレート

| 項目 | 結果 | 備考 |
| ---- | ---- | ---- |
| 実行日時 | YYYY-MM-DD HH:MM | 例: 2025-10-07 08:00 JST |
| PM_PORT / UI_PORT | 3103 / 4103 | `scripts/run_podman_ui_poc.sh --detach` の引数 |
| `scripts/podman_status.sh` | ✅ / ❌ | 成功時は `ok` 表示をメモ |
| Projects 一覧件数 | 4 | `curl http://localhost:${PM_PORT}/api/v1/projects` |
| Timesheets submitted 件数 | 2 | `curl http://localhost:${PM_PORT}/api/v1/timesheets?status=submitted` |
| Compliance 検索件数 | 3 | `curl http://localhost:${PM_PORT}/api/v1/compliance/invoices?limit=5` |
| Telemetry 取得 | 0 | `TELEMETRY_BASE=http://localhost:${PM_PORT} node scripts/show_telemetry.js` |
| Telemetry 送信 | - | `PM_PORT=${PM_PORT} scripts/send_telemetry_sample.sh` などでイベント生成 |
| フィードバック | - | UI/UX 改善や不具合を箇条書き |

`docs/podman-ui-workflow.md` の手順に従い実施し、必要に応じて Issue へコメントや新規Issue作成を行ってください。
