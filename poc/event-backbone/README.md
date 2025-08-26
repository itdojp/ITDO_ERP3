# Event Backbone PoC — AWS vs GCP

目的: 低コスト・低運用のイベント基盤（AWS vs GCP）を同一シナリオで比較検証し、MVPの主クラウドを決定する。

対象シナリオ（共通）
- `pm.timesheet.approved` → `fi.invoice.generated`
- 集約ID: `timesheetId`（ordering key / message group id）
- 冪等性: Idempotency-Key + 重複検知テーブル

評価観点（重み例）
- コスト（30%）: 月額/1万・10万イベント時の概算
- 運用（25%）: 監視/アラート、DLQ/リドライブ、IaCの容易さ
- 性能（20%）: E2E p95、スループット安定性、スパイク耐性
- 信頼性（15%）: 再処理、順序保証（集約ID単位）、耐障害性
- 開発体験（10%）: SDK/ローカルテスト、デバッグ容易性

測定項目
- レイテンシ: Pub→Consume→DB/Stub完了までのE2E（p50/p95）
- 失敗処理: DLQ移送率、リトライ成功率
- 重複抑止: 冪等処理の成功率
- コスト: サービス別（イベント・リクエスト・GB秒・ストレージ）

計測方法
- 送信ツール: バッチ送信（100/1,000/10,000 events）
- サンプリング: 各負荷で3回、平均/分位を採取
- 可観測性: 各クラウド標準モニタリング + ログ（trace id付）

成果物
- 比較レポート（metrics.mdのテンプレに記入）
- 決定チケット（Issues #9）への結論/根拠の記載

関連
- AWS案: aws.md
- GCP案: gcp.md
- 共通スキーマ: schema/timesheet_approved.json, schema/invoice_generated.json
- メトリクステンプレ: metrics.md

