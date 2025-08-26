# ADR 0002: イベント基盤（低コスト・低運用）

- Status: Proposed
- Date: 2025-08-27
- Owners: アーキテクト、バックエンドTL

## Context
- 非同期イベント連携が必要（例: `pm.timesheet.approved -> fi.invoice.generated`）。
- 要求: 低コスト・運用簡素、順序（集約ID単位）、少なくとも1回配信、再処理、監査保管。
- 大規模なストリーム処理や厳密な長期リプレイはMVPでは不要。

## Decision
- AWS採用時は「EventBridge + SQS(+FIFO) + Lambda」を標準とする。
- Google Cloud採用時は「Pub/Sub + Cloud Run/Functions + Eventarc(+Workflows)」を標準とする。
- どちらもペイロード大はオブジェクトストレージ（S3/GCS）に退避し、イベントは参照を持つ。

## Options Considered

### A. AWS: EventBridge + SQS (+FIFO) + Lambda
- ルーティング: EventBridge ルール → SQS キュー（用途別、必要箇所のみFIFO）
- 消費: Lambda（関数）、DLQ/リドライブはSQS/CloudWatch経由
- 順序: SQS FIFOのMessageGroupId=集約ID
- 再処理: EventBridge Archive/Replay + S3エクスポート
- オーケストレーション（必要時）: Step Functions
- 監視: CloudWatch（レイテンシ/エラー率/キュー深さ）
- セキュリティ: IAM, VPCエンドポイント, KMS
- 長所: フルマネージドで低運用、アイドルコスト低
- 短所: Kafkaのような長期リプレイは弱い（Archive+S3で補完）

### B. GCP: Pub/Sub + Cloud Run/Functions + Eventarc (+Workflows)
- ルーティング: 基本はPub/Sub（トピック/サブスクリプション）。必要に応じEventarcでソース→ターゲット配線。
- 消費: Cloud Run（推奨）または Cloud Functions（Gen2）。DLT（Dead Letter Topic）運用。
- 順序: Pub/Sub Ordering Key=集約ID（トピック側で順序有効化）。
- 再処理: Pub/Subのseek（保持期間内） + BigQuery/GCSシンクで長期保管→再出版。
- オーケストレーション（必要時）: Workflows。
- 監視: Cloud Monitoring/Logging, Error Reporting。
- セキュリティ: IAM, CMEK（Cloud KMS）, VPC-SC/Serverless VPC Access。
- 長所: フルマネージド/低運用、スケール容易、コスト低。
- 短所: デフォルト長期リプレイは弱く、長期はGCS/BigQuery併用。

## Consequences
- Kafka/MSKを使わないため、超大規模ストリームや長期ログリプレイの要求が将来拡大した場合は再検討。
- その代替として、長期保管はS3/GCSへ定期吐き出しし、必要時に再出版パイプラインを用意する。

## Implementation (MVP 指針)

共通
- イベント命名: `{module}.{entity}.{action}`（例: `fi.invoice.generated`）。
- スキーマ: JSON Schema（将来Avro/Protobuf拡張可）。
- 冪等性: コンシューマ側でIdempotency-Key＋重複検知テーブル。
- ペイロード > 上限: 本体はS3/GCS、イベントはメタ＋URL参照。

AWS
- EventBridge バス/ルール定義 → SQS（標準/ FIFO）へ配信。
- Lambda コンシューマ、DLQはSQS。CloudWatchでアラーム。
- Archive/Replay有効化。7年保管はS3（Object Lock/WORM）で実施。

GCP
- Pub/Sub トピック（ordering有効）+ サブスクリプション（DLT設定）。
- Cloud Run（HTTP/PubSub push）コンシューマ。必要時Cloud Functions。
- Dataflow/サブスクライバでBigQuery/GCSへ吐き出し（7年保管: GCS）。
- Eventarc（必要時）でイベントソース→ターゲット連携。Workflowsで業務オーケストレーション。

## Rollout
- フェーズ0（PoC）: `pm.timesheet.approved -> fi.invoice.generated` のE2Eを最小構成で検証。
- フェーズ1（MVP）: コア4トピック運用、DLQ/監視、長期アーカイブ連携（S3/GCS）。
- フェーズ2（拡張）: 再処理UI/運用Runbook整備、スキーマレジストリ/互換性ルール導入を検討。

## Open Questions
- 長期リプレイ要件（年単位）が厳格化した場合の追加コスト許容範囲。
- 厳密一回配送の必要性（現状は少なくとも一回+冪等でカバー）。
- JSON SchemaとAvro/Protobufのどちらを標準化するか（段階導入案）。

